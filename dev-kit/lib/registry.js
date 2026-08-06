'use strict'

// The user-level project registry behind `devkit project` — a JSON array of {name, root} at
// $XDG_CONFIG_HOME/devkit/projects.json (or ~/.config/devkit/projects.json). It lives outside any
// single project because the dashboard must enumerate projects independent of cwd, and it is a
// plain hand-edit-able file rather than a hidden dotfile per project.
//
// Every function here takes an explicit registry file path so the CLI binds the default path, the
// dashboard passes its own, and the tests pass a temp one — none of them ever touch the real one.

const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const { parseArgs } = require('./plan')

// The path only the CLI's default binding uses; the tests and the dashboard pass their own file.
function registryPath(env = process.env, home = os.homedir()) {
  const base = env.XDG_CONFIG_HOME ? path.resolve(env.XDG_CONFIG_HOME) : path.join(home, '.config')
  return path.join(base, 'devkit', 'projects.json')
}

class RegistryError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RegistryError'
  }
}

async function loadRegistry(file = registryPath()) {
  let raw
  try {
    raw = await fsp.readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw new RegistryError(`could not read the registry at ${file}: ${e.message}`)
  }
  let entries
  try {
    entries = JSON.parse(raw)
  } catch (e) {
    throw new RegistryError(`registry ${file} is not valid JSON: ${e.message}`)
  }
  if (!Array.isArray(entries)) throw new RegistryError(`registry ${file} must be a JSON array of {name, root}`)
  for (const entry of entries) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.root !== 'string') {
      throw new RegistryError(`registry ${file} has an entry that is not {name, root}`)
    }
  }
  return entries
}

// Same-directory temp file plus rename, mirroring lib/plan.js's writePlanFile: a process killed
// mid-write leaves the registry exactly as it was, never half-written JSON. The parent directory is
// created first because the first add creates the file.
async function saveRegistry(file, entries) {
  const dir = path.dirname(file)
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}-${Date.now()}.tmp`)
  try {
    await fsp.mkdir(dir, { recursive: true })
    await fsp.writeFile(tmp, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
    await fsp.rename(tmp, file)
  } catch (e) {
    await fsp.unlink(tmp).catch(() => {})
    throw new RegistryError(`could not write the registry at ${file}: ${e.message}`)
  }
}

async function addProject(file, dirPath, opts = {}) {
  const abs = path.resolve(dirPath)
  let st
  try {
    st = await fsp.stat(abs)
  } catch (e) {
    throw new RegistryError(`no such project directory: ${abs}`)
  }
  if (!st.isDirectory()) throw new RegistryError(`not a directory: ${abs}`)
  const hasGit = await pathExists(path.join(abs, '.git'))
  const hasDevKit = await pathExists(path.join(abs, '.dev-kit'))
  if (!hasGit && !hasDevKit) throw new RegistryError(`${abs} has neither .git nor .dev-kit; not a project`)
  const root = await fsp.realpath(abs)
  const name = opts.name || path.basename(root)
  // A name must be one URL path segment: an empty or slashed name registers a project the
  // dashboard can never route to (/projects// or /projects/a/b), and '.'/'..' would alias the
  // project page itself.
  if (!name || name === '.' || name === '..' || name.includes('/')) {
    throw new RegistryError(`project name must be non-empty and a single path segment: "${name}"`)
  }
  const entries = await loadRegistry(file)
  if (entries.some(e => e.root === root)) throw new RegistryError(`root ${root} is already registered`)
  if (entries.some(e => e.name === name)) throw new RegistryError(`name "${name}" is already registered`)
  const next = entries.concat({ name, root })
  await saveRegistry(file, next)
  return next
}

async function removeProject(file, name) {
  const entries = await loadRegistry(file)
  const idx = entries.findIndex(e => e.name === name)
  if (idx < 0) throw new RegistryError(`no project named "${name}" in the registry`)
  const next = entries.filter(e => e.name !== name)
  await saveRegistry(file, next)
  return next
}

async function pathExists(p) {
  try {
    await fsp.stat(p)
    return true
  } catch {
    return false
  }
}

const USAGE = `devkit project add <path> [--name <n>]   Register a project directory
devkit project list                     List registered projects, one "name  root" per line
devkit project remove <name>            Remove a registered project's entry (leaves the project files)`

// Positionals first, then flags — parseArgs is lib/plan.js's, shared so the two CLIs cannot drift.

async function cmdProject(argv, io = {}) {
  const out = io.out || (s => console.log(s))
  const err = io.err || (s => console.error(s))
  const file = io.file || registryPath()
  const sub = argv[0]

  if (sub === 'list') {
    try {
      for (const e of await loadRegistry(file)) out(`${e.name}  ${e.root}`)
      return 0
    } catch (e) { err(`devkit: ${e.message}`); return 1 }
  }

  if (sub === 'add') {
    const { positional, flags, error } = parseArgs(argv.slice(1), ['path'], ['--name'])
    if (error) { err(`devkit: ${error}\n${USAGE}`); return 1 }
    try {
      await addProject(file, positional[0], { name: flags.name })
      return 0
    } catch (e) { err(`devkit: ${e.message}`); return 1 }
  }

  if (sub === 'remove') {
    const { positional, flags, error } = parseArgs(argv.slice(1), ['name'], [])
    if (error) { err(`devkit: ${error}\n${USAGE}`); return 1 }
    try {
      await removeProject(file, positional[0])
      return 0
    } catch (e) { err(`devkit: ${e.message}`); return 1 }
  }

  err(`devkit: project needs add, list or remove${sub ? `, not "${sub}"` : ''}\n${USAGE}`)
  return 1
}

module.exports = {
  registryPath, RegistryError, loadRegistry, saveRegistry, addProject, removeProject, cmdProject,
}

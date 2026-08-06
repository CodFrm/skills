'use strict'

// Run: node --test dev-kit/tests/registry.test.js
//
// Covers lib/registry.js, the user-level project registry behind `devkit project`. The registry is
// independent of any project: it lives outside cwd so the dashboard can enumerate projects without
// cd'ing, and every function here takes an explicit registry file path so tests never touch the
// real ~/.config.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const {
  registryPath, loadRegistry, saveRegistry, addProject, removeProject, cmdProject,
} = require('../lib/registry')

// macOS puts temp dirs behind /var -> /private/var and the registry stores realpaths, so the
// fixture root has to be realpath'd too or every assertion fails for the wrong reason.
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-registry-test-')))
const home = path.join(tmp, 'home')

function project(name) {
  const root = path.join(tmp, name)
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  return root
}

test.before(() => fs.mkdirSync(home, { recursive: true }))
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

test('registryPath respects XDG_CONFIG_HOME and falls back to ~/.config', () => {
  const xdg = path.join(tmp, 'xdg')
  assert.equal(registryPath({ XDG_CONFIG_HOME: xdg }, home), path.join(xdg, 'devkit', 'projects.json'))
  assert.equal(registryPath({}, home), path.join(home, '.config', 'devkit', 'projects.json'))
})

test('loadRegistry: a missing file is an empty registry', async () => {
  assert.deepEqual(await loadRegistry(path.join(tmp, 'nope.json')), [])
})

test('addProject: registers, defaulting name to basename and creating parent dirs', async () => {
  // The parent directory does not exist yet — the first add creates it.
  const file = path.join(tmp, 'reg', 'nested', 'projects.json')
  const root = project('alpha')
  await addProject(file, root)
  assert.deepEqual(await loadRegistry(file), [{ name: 'alpha', root }])
  // Only the registry file lives in the directory; no temp file is left behind.
  assert.deepEqual(fs.readdirSync(path.join(tmp, 'reg', 'nested')), ['projects.json'])
})

test('addProject: a .dev-kit-only directory is accepted', async () => {
  const file = path.join(tmp, 'devkit-only.json')
  const root = path.join(tmp, 'dk-only')
  fs.mkdirSync(path.join(root, '.dev-kit'), { recursive: true })
  await addProject(file, root)
  assert.deepEqual(await loadRegistry(file), [{ name: 'dk-only', root }])
})

test('addProject: stores the realpath of a symlinked project dir, and the name follows', async () => {
  const file = path.join(tmp, 'symlink.json')
  const real = project('real-proj')
  const link = path.join(tmp, 'link-proj')
  fs.symlinkSync(real, link)
  await addProject(file, link)
  assert.deepEqual(await loadRegistry(file), [{ name: 'real-proj', root: real }])
})

test('addProject: a non-directory is refused', async () => {
  const file = path.join(tmp, 'notdir.json')
  const plain = path.join(tmp, 'plain.txt')
  fs.writeFileSync(plain, 'x')
  await assert.rejects(addProject(file, plain), /not a directory/)
  assert.deepEqual(await loadRegistry(file), [])
})

test('addProject: a directory with neither .git nor .dev-kit is refused', async () => {
  const file = path.join(tmp, 'bare.json')
  const bare = path.join(tmp, 'bare')
  fs.mkdirSync(bare, { recursive: true })
  await assert.rejects(addProject(file, bare), /neither \.git nor \.dev-kit/)
  assert.deepEqual(await loadRegistry(file), [])
})

test('addProject: a missing path is refused', async () => {
  const file = path.join(tmp, 'ghost.json')
  await assert.rejects(addProject(file, path.join(tmp, 'ghost')), /no such project directory/)
})

test('addProject: a duplicate root is refused', async () => {
  const file = path.join(tmp, 'duproot.json')
  const root = project('dup')
  await addProject(file, root)
  await assert.rejects(addProject(file, root), /already registered/)
  assert.deepEqual(await loadRegistry(file), [{ name: 'dup', root }])
})

test('addProject: a duplicate name is refused even from a different root', async () => {
  const file = path.join(tmp, 'dupname.json')
  await addProject(file, project('first'), { name: 'tag' })
  await assert.rejects(addProject(file, project('second'), { name: 'tag' }), /already registered/)
  assert.deepEqual(await loadRegistry(file), [{ name: 'tag', root: path.join(tmp, 'first') }])
})

test('addProject: --name overrides the basename default', async () => {
  const file = path.join(tmp, 'named.json')
  const root = project('renamed')
  const code = await cmdProject(['add', root, '--name', 'fancy'], { file, out: () => {}, err: () => {} })
  assert.equal(code, 0)
  assert.deepEqual(await loadRegistry(file), [{ name: 'fancy', root }])
})

test('removeProject: removes the entry and leaves project files untouched', async () => {
  const file = path.join(tmp, 'remove.json')
  const root = project('gone')
  await addProject(file, root)
  await removeProject(file, 'gone')
  assert.deepEqual(await loadRegistry(file), [])
  assert.ok(fs.existsSync(path.join(root, '.git')))
})

test('removeProject: an unknown name is refused', async () => {
  const file = path.join(tmp, 'unknown.json')
  await assert.rejects(removeProject(file, 'nope'), /no project named/)
})

test('loadRegistry: corrupted JSON is an error, not silently empty', async () => {
  const file = path.join(tmp, 'broken.json')
  fs.writeFileSync(file, '{not json')
  await assert.rejects(loadRegistry(file), /not valid JSON/)
})

test('loadRegistry: a non-array registry is an error', async () => {
  const file = path.join(tmp, 'object.json')
  fs.writeFileSync(file, '{"name": "x"}')
  await assert.rejects(loadRegistry(file), /must be a JSON array/)
})

test('saveRegistry: writes atomically, leaving no temp file behind', async () => {
  const dir = path.join(tmp, 'atomic')
  const file = path.join(dir, 'projects.json')
  await saveRegistry(file, [{ name: 'x', root: '/tmp/x' }])
  assert.deepEqual(fs.readdirSync(dir), ['projects.json'])
  assert.deepEqual(await loadRegistry(file), [{ name: 'x', root: '/tmp/x' }])
})

test('cmdProject list prints one name  root line per entry', async () => {
  const file = path.join(tmp, 'list.json')
  const root = project('cli')
  await addProject(file, root)
  const lines = []
  const code = await cmdProject(['list'], { file, out: s => lines.push(s), err: () => {} })
  assert.equal(code, 0)
  assert.deepEqual(lines, [`cli  ${root}`])
})

test('cmdProject add reports a validation failure and exits 1', async () => {
  const file = path.join(tmp, 'cli-bare.json')
  const bare = path.join(tmp, 'cli-bare')
  fs.mkdirSync(bare, { recursive: true })
  const errs = []
  const code = await cmdProject(['add', bare], { file, out: () => {}, err: s => errs.push(s) })
  assert.equal(code, 1)
  assert.ok(errs[0].includes('neither .git nor .dev-kit'))
  assert.deepEqual(await loadRegistry(file), [])
})

test('cmdProject remove reports a missing name and exits 1', async () => {
  const file = path.join(tmp, 'cli-remove.json')
  const errs = []
  const code = await cmdProject(['remove', 'nope'], { file, out: () => {}, err: s => errs.push(s) })
  assert.equal(code, 1)
  assert.ok(errs[0].includes('no project named'))
})

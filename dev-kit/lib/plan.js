'use strict'

// Reading and addressing .dev-kit/plans/*.yaml.
//
// Zero dependencies means no YAML parser, and a hand-written round-trip would reflow the folded
// scalars a plan is mostly made of. So this reads the plan shape by indentation and keeps the line
// each value was found on: that line is the address the write commands edit, and everything here
// exists to make it trustworthy.
//
//   Only the known shape parses. A flow mapping, a tab indent, an unterminated quote — anything
//   this reader cannot account for throws with a line number instead of being skipped, because a
//   line it skipped is a line it would mis-count.
//
//   A block scalar's body is consumed by indentation, never by looking for `key:`. Plan prose
//   quotes plan fields constantly; a reader that matched lines would address someone's note.
//
//   One key written twice in one object has no address. entryOf throws rather than return the
//   first match, since a write to the shadowed line is a write nobody reads.

const fsp = require('fs/promises')
const path = require('path')
const { PLANS, findRoot, resolveInside } = require('./project')

// The state vocabulary, single source for every command. It is the one published by the plan
// template in skills/writing-plans/SKILL.md, and tests/plan.test.js asserts they stay equal.
const VOCAB = {
  status: ['draft', 'ready', 'running', 'done', 'stopped'],
  mode: ['subagent', 'inline'],
  taskStatus: ['todo', 'doing', 'reviewing', 'done', 'blocked'],
  reviewStatus: ['pending', 'passed', 'stopped'],
  verificationStatus: ['pending', 'running', 'reported', 'accepted', 'blocked'],
}

// The keys the schema knows, per object. Anything else is a note, and its value is not descended
// into: an improvised key is somebody's structure, not a typo to be graded.
const KEYS = {
  plan: ['spec', 'status', 'mode', 'worktree', 'goal', 'context', 'tasks', 'parallel_evidence', 'review', 'verification'],
  task: ['id', 'goal', 'deps', 'files', 'model', 'interfaces', 'status', 'commit', 'note'],
  evidence: ['tasks', 'head', 'source', 'writes', 'dependencies', 'resources', 'verification'],
  review: ['status', 'fixes'],
  verification: ['status', 'report', 'head', 'note'],
}

class PlanError extends Error {
  constructor(message, line) {
    super(message)
    this.name = 'PlanError'
    this.line = line
  }
}

// --- the reader ---------------------------------------------------------------------------------

const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):(?:[ \t]+([\s\S]*))?$/
const ITEM_RE = /^-(?:[ \t]+([\s\S]*))?$/
const BLOCK_RE = /^[>|][-+]?\d*$/

const scalar = (line, endLine, text, style) => ({ kind: 'scalar', line, endLine, text, style })

function indentOf(raw, lineNo) {
  const m = /^[ ]*/.exec(raw)[0].length
  if (raw[m] === '\t') throw new PlanError('a tab indents this line; plans are indented with spaces', lineNo)
  return m
}

const isBlank = raw => raw.trim() === '' || raw.trim().startsWith('#')

// Advances past blank and comment lines. False at end of file.
function skipBlank(st) {
  while (st.i < st.lines.length && isBlank(st.lines[st.i])) st.i++
  return st.i < st.lines.length
}

function nextSignificant(st) {
  let j = st.i
  while (j < st.lines.length && isBlank(st.lines[j])) j++
  return j < st.lines.length ? j : -1
}

function parseMap(st, indent, seed) {
  const entries = seed ? seed.slice() : []
  while (skipBlank(st)) {
    const raw = st.lines[st.i]
    const ind = indentOf(raw, st.i + 1)
    if (ind < indent) break
    if (ind > indent) throw new PlanError('this line is indented past the key it belongs to', st.i + 1)
    const m = KEY_RE.exec(raw.slice(ind))
    if (!m) {
      if (ITEM_RE.test(raw.slice(ind))) break
      throw new PlanError('neither a key nor a list item', st.i + 1)
    }
    const line = st.i + 1
    st.i++
    entries.push({ key: m[1], line, indent: ind, value: parseValue(st, m[2], ind, line) })
  }
  return { kind: 'map', line: entries.length ? entries[0].line : st.i + 1, indent, entries }
}

function parseSeq(st, indent) {
  const items = []
  const line = st.i + 1
  while (skipBlank(st)) {
    const raw = st.lines[st.i]
    const ind = indentOf(raw, st.i + 1)
    if (ind < indent) break
    if (ind > indent) throw new PlanError('this line is indented past the list it belongs to', st.i + 1)
    const m = ITEM_RE.exec(raw.slice(ind))
    if (!m) break
    const itemLine = st.i + 1
    const rest = m[1]
    st.i++
    if (rest !== undefined && KEY_RE.test(rest)) {
      // `- id: 1`: a mapping whose first key sits on the dash line, indented to that key's column.
      const childIndent = raw.length - rest.length
      const k = KEY_RE.exec(rest)
      const first = { key: k[1], line: itemLine, indent: childIndent, value: parseValue(st, k[2], childIndent, itemLine) }
      items.push(parseMap(st, childIndent, [first]))
    } else {
      items.push(parseValue(st, rest, indent, itemLine))
    }
  }
  return { kind: 'seq', line, indent, inline: false, items }
}

function parseValue(st, rest, keyIndent, keyLine) {
  const head = rest === undefined ? '' : rest.trim()
  if (head === '' || head.startsWith('#')) {
    const j = nextSignificant(st)
    if (j >= 0) {
      const ind = indentOf(st.lines[j], j + 1)
      const item = ITEM_RE.test(st.lines[j].slice(ind))
      if (ind > keyIndent || (ind === keyIndent && item)) {
        st.i = j
        return item ? parseSeq(st, ind) : parseMap(st, ind)
      }
    }
    return scalar(keyLine, keyLine, null, 'empty')
  }
  if (head[0] === '>' || head[0] === '|') return parseBlockScalar(st, head, keyIndent, keyLine)
  if (head[0] === '[') return parseInlineSeq(head, keyLine)
  if (head[0] === '{') throw new PlanError('a flow mapping is not part of the plan shape', keyLine)
  return scalar(keyLine, keyLine, decodeScalar(head, keyLine), 'inline')
}

function parseBlockScalar(st, head, keyIndent, keyLine) {
  const style = head.split(/[ \t]+#/)[0].trim()
  if (!BLOCK_RE.test(style)) throw new PlanError(`"${style}" is not a block scalar header this reader knows`, keyLine)
  const body = []
  // The index just past the last content line, which is also that line's 1-based number.
  let endLine = keyLine
  while (st.i < st.lines.length) {
    const raw = st.lines[st.i]
    if (raw.trim() !== '' && indentOf(raw, st.i + 1) <= keyIndent) break
    body.push(raw)
    st.i++
    if (raw.trim() !== '') endLine = st.i
  }
  // Trailing blank lines belong to whatever comes next, not to the scalar.
  while (body.length && body[body.length - 1].trim() === '') body.pop()
  st.i = endLine
  const strip = body.length ? indentOf(body[0], keyLine + 1) : 0
  const text = body.map(l => l.slice(strip).trimEnd())
  const folded = style[0] === '>'
  let joined = ''
  for (const [n, l] of text.entries()) {
    if (n === 0) joined = l
    else if (l === '' || text[n - 1] === '') joined += '\n' + l
    else joined += (folded ? ' ' : '\n') + l
  }
  return scalar(keyLine, endLine, joined.replace(/^\n+|\n+$/g, ''), style)
}

function parseInlineSeq(head, keyLine) {
  const m = /^\[([^[\]{}]*)\](?:[ \t]+#.*)?$/.exec(head)
  if (!m) throw new PlanError('an inline list must open and close on one line, without nesting', keyLine)
  const inner = m[1].trim()
  const items = inner === '' ? [] : inner.split(',').map(s => scalar(keyLine, keyLine, decodeScalar(s.trim(), keyLine), 'inline'))
  return { kind: 'seq', line: keyLine, indent: null, inline: true, items }
}

function decodeScalar(raw, line) {
  const s = raw.replace(/\r$/, '')
  if (s[0] === '"' || s[0] === "'") {
    const q = s[0]
    let i = 1
    let text = ''
    for (; i < s.length; i++) {
      if (q === '"' && s[i] === '\\') { text += s[++i] === 'n' ? '\n' : s[i]; continue }
      if (s[i] === q) {
        if (q === "'" && s[i + 1] === "'") { text += "'"; i++; continue }
        break
      }
      text += s[i]
    }
    if (i >= s.length) throw new PlanError('a quoted value that never closes', line)
    const tail = s.slice(i + 1).trim()
    if (tail !== '' && !tail.startsWith('#')) throw new PlanError('trailing text after a quoted value', line)
    return text
  }
  const plain = s.split(/[ \t]+#/)[0].trim()
  return plain === '' || plain === 'null' || plain === '~' ? null : plain
}

function parsePlan(text, file) {
  const st = { lines: text.split('\n'), i: 0, file }
  const root = parseMap(st, 0)
  if (skipBlank(st)) throw new PlanError('neither a key nor a list item', st.i + 1)
  return { file, text, lines: st.lines, root }
}

// --- addressing ---------------------------------------------------------------------------------

function entryOf(node, key) {
  if (!node || node.kind !== 'map') return null
  const found = node.entries.filter(e => e.key === key)
  if (found.length > 1) {
    const at = found.map(e => e.line).join(', ')
    throw new PlanError(`"${key}" is written ${found.length} times in one object (lines ${at}), so it has no single address`, found[1].line)
  }
  return found[0] || null
}

const textOf = (node, key) => {
  const e = entryOf(node, key)
  return e && e.value.kind === 'scalar' ? e.value.text : null
}

function taskNodes(doc) {
  const e = entryOf(doc.root, 'tasks')
  if (!e || e.value.kind !== 'seq') return []
  return e.value.items.filter(n => n.kind === 'map')
}

function taskNode(doc, id) {
  const found = taskNodes(doc).filter(t => textOf(t, 'id') === String(id))
  if (found.length > 1) {
    throw new PlanError(`two tasks answer to id ${id} (lines ${found.map(t => t.line).join(', ')})`, found[1].line)
  }
  return found[0] || null
}

const depsOf = node => {
  const e = entryOf(node, 'deps')
  return e && e.value.kind === 'seq' ? { line: e.line, ids: e.value.items.map(i => i.text) } : { line: node.line, ids: [] }
}

// Ready is `status: todo` with every dep `done` — executing-plans/SKILL.md's definition.
function readyTasks(doc) {
  const tasks = taskNodes(doc)
  const status = new Map()
  for (const t of tasks) {
    const id = textOf(t, 'id')
    if (id !== null && status.has(id)) throw new PlanError(`two tasks answer to id ${id}`, t.line)
    status.set(id, textOf(t, 'status'))
  }
  const ready = []
  for (const t of tasks) {
    const { line, ids } = depsOf(t)
    for (const dep of ids) {
      if (!status.has(dep)) throw new PlanError(`task ${textOf(t, 'id')} depends on task ${dep}, which this plan does not have`, line)
    }
    if (textOf(t, 'status') === 'todo' && ids.every(d => status.get(d) === 'done')) {
      ready.push({ id: textOf(t, 'id'), goal: textOf(t, 'goal'), line: t.line })
    }
  }
  return ready
}

// --- check ---------------------------------------------------------------------------------------

function checkPlan(doc) {
  const errors = []
  const notes = []
  const root = doc.root
  const fail = (line, message) => errors.push({ line, message })

  // An ambiguous key is reported once, here, and every reader below then skips it.
  const guard = fn => {
    try { return fn() } catch (e) {
      if (!(e instanceof PlanError)) throw e
      return undefined
    }
  }
  const known = (node, label, schema) => {
    const seen = new Map()
    for (const e of node.entries) {
      if (seen.has(e.key)) fail(e.line, `${label}${e.key}: written twice in one object, also on line ${seen.get(e.key)}`)
      else seen.set(e.key, e.line)
      if (!schema.includes(e.key)) notes.push({ line: e.line, message: `${label}${e.key}: not a key of the plan schema` })
    }
  }
  const vocab = (node, key, label, allowed, { required = false, nullable = false } = {}) => {
    const e = guard(() => entryOf(node, key))
    if (e === undefined) return
    if (!e) {
      if (required) fail(node.line, `${label}: missing`)
      return
    }
    const value = e.value.kind === 'scalar' ? e.value.text : '<not a value>'
    if (value === null && nullable) return
    if (!allowed.includes(value)) fail(e.line, `${label}: "${value}" is not one of ${allowed.join(', ')}`)
  }

  known(root, '', KEYS.plan)
  vocab(root, 'status', 'status', VOCAB.status, { required: true })
  vocab(root, 'mode', 'mode', VOCAB.mode, { nullable: true })

  const tasksEntry = guard(() => entryOf(root, 'tasks'))
  if (tasksEntry === null) fail(root.line, 'tasks: missing')
  else if (tasksEntry && tasksEntry.value.kind !== 'seq') fail(tasksEntry.line, 'tasks: not a list of tasks')

  const ids = new Map()
  for (const t of taskNodes(doc)) {
    const id = guard(() => textOf(t, 'id'))
    const label = id ? `task ${id}: ` : 'task: '
    known(t, label, KEYS.task)
    if (id === null) fail(t.line, 'task: no id')
    else if (id !== undefined) {
      if (ids.has(id)) fail(t.line, `task: id ${id} is claimed twice, also on line ${ids.get(id)}`)
      else ids.set(id, t.line)
    }
    vocab(t, 'status', `${label}status`, VOCAB.taskStatus, { required: true })
  }
  // Second pass: a dep may name a task cut further down the file.
  for (const t of taskNodes(doc)) {
    const { line, ids: deps } = depsOf(t)
    const label = guard(() => textOf(t, 'id')) || '?'
    for (const dep of deps) {
      if (!ids.has(dep)) fail(line, `task ${label}: deps names task ${dep}, which this plan does not have`)
    }
  }

  const evidence = guard(() => entryOf(root, 'parallel_evidence'))
  if (evidence && evidence.value.kind === 'seq') {
    for (const item of evidence.value.items) if (item.kind === 'map') known(item, 'parallel_evidence: ', KEYS.evidence)
  }
  for (const [key, schema, allowed] of [['review', KEYS.review, VOCAB.reviewStatus], ['verification', KEYS.verification, VOCAB.verificationStatus]]) {
    const e = guard(() => entryOf(root, key))
    if (!e || e.value.kind !== 'map') continue
    known(e.value, `${key}.`, schema)
    vocab(e.value, 'status', `${key}.status`, allowed)
  }

  const byLine = (a, b) => a.line - b.line
  return { errors: errors.sort(byLine), notes: notes.sort(byLine) }
}

// --- picking the plan ------------------------------------------------------------------------------

// planDir is the boundary root passed to resolveInside — see PLANS in ./project.js.
async function findPlans(planDir) {
  const dir = await resolveInside(planDir, '')
  if (!dir) return null
  const names = (await fsp.readdir(dir)).filter(n => n.endsWith('.yaml')).sort()
  const plans = []
  for (const name of names) {
    const file = await resolveInside(planDir, name)
    if (!file) continue
    let status = null
    try {
      status = textOf(parsePlan(await fsp.readFile(file, 'utf8'), name).root, 'status')
    } catch { status = null }
    plans.push({ slug: name.replace(/\.yaml$/, ''), name, file, status })
  }
  return plans
}

// --- the command -------------------------------------------------------------------------------

const SUBS = { next: ['--plan'], show: ['--plan', '--task'], check: ['--plan'] }
const USAGE = `usage: devkit plan <next|show|check> [--plan <slug>] [--task <id>]`

function parseFlags(argv, allowed) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (!allowed.includes(argv[i])) return { error: `unexpected argument "${argv[i]}"` }
    if (i + 1 >= argv.length) return { error: `${argv[i]} needs a value` }
    flags[argv[i].slice(2)] = argv[++i]
  }
  return { flags }
}

const renderValue = node => {
  if (node.kind === 'seq') return `[${node.items.map(i => (i.kind === 'scalar' ? i.text : '...')).join(', ')}]`
  if (node.kind === 'map') return `{${node.entries.map(e => e.key).join(', ')}}`
  return node.text === null ? 'null' : node.text
}

async function cmdPlan(argv, io = {}) {
  const cwd = io.cwd || process.cwd()
  const out = io.out || (s => console.log(s))
  const err = io.err || (s => console.error(s))
  const sub = argv[0]

  if (!Object.prototype.hasOwnProperty.call(SUBS, sub || '')) {
    err(`devkit: plan needs a subcommand${sub ? `, and "${sub}" is not one` : ''}\n${USAGE}`)
    return 1
  }
  const { flags, error } = parseFlags(argv.slice(1), SUBS[sub])
  if (error) { err(`devkit: ${error}\n${USAGE}`); return 1 }

  const root = findRoot(cwd)
  if (!root) { err('devkit: no project root found (looked upwards for .git or .dev-kit)'); return 1 }
  const planDir = path.join(root, PLANS)
  const plans = await findPlans(planDir)
  if (!plans) { err(`devkit: no ${PLANS}/ directory under ${root}`); return 1 }

  let chosen
  if (flags.plan !== undefined) {
    const slug = flags.plan.replace(/\.yaml$/, '')
    const file = await resolveInside(planDir, `${slug}.yaml`)
    if (!file) { err(`devkit: no plan "${slug}" in ${PLANS}/${plans.length ? ` (have ${plans.map(p => p.slug).join(', ')})` : ''}`); return 1 }
    chosen = { slug, name: path.basename(file), file }
  } else {
    const live = plans.filter(p => p.status !== 'done')
    if (live.length !== 1) {
      const have = plans.length ? plans.map(p => `${p.slug} (${p.status})`).join(', ') : 'none'
      err(`devkit: ${live.length} plans in ${PLANS}/ are not done, so --plan <slug> is needed; have: ${have}`)
      return 1
    }
    chosen = live[0]
  }

  const name = chosen.name
  const fail = e => {
    if (!(e instanceof PlanError)) throw e
    err(`devkit: ${name}${e.line ? `:${e.line}` : ''}: ${e.message}`)
    return 1
  }

  let doc
  try {
    doc = parsePlan(await fsp.readFile(chosen.file, 'utf8'), name)
  } catch (e) { return fail(e) }

  try {
    if (sub === 'next') {
      for (const t of readyTasks(doc)) out(`${t.id}  ${t.goal === null ? '' : t.goal}`)
      return 0
    }
    if (sub === 'show') return showPlan(doc, chosen, flags, out, err)
    const { errors, notes } = checkPlan(doc)
    for (const n of notes) out(`${name}:${n.line}: note: ${n.message}`)
    for (const e of errors) err(`${name}:${e.line}: ${e.message}`)
    return errors.length ? 1 : 0
  } catch (e) { return fail(e) }
}

function showPlan(doc, chosen, flags, out, err) {
  if (flags.task !== undefined) {
    const task = taskNode(doc, flags.task)
    if (!task) { err(`devkit: ${chosen.name}: no task with id ${flags.task}`); return 1 }
    for (const e of task.entries) out(`${e.key}: ${renderValue(e.value)}`)
    return 0
  }
  const state = key => {
    const e = entryOf(doc.root, key)
    return e ? renderValue(e.value) : 'null'
  }
  const nested = key => {
    const e = entryOf(doc.root, key)
    const status = e && e.value.kind === 'map' ? entryOf(e.value, 'status') : null
    return status ? renderValue(status.value) : 'null'
  }
  out(`plan: ${chosen.slug}`)
  out(`status: ${state('status')}`)
  out(`mode: ${state('mode')}`)
  out(`worktree: ${state('worktree')}`)
  out(`review.status: ${nested('review')}`)
  out(`verification.status: ${nested('verification')}`)
  out('tasks:')
  for (const t of taskNodes(doc)) out(`  ${textOf(t, 'id')}  ${textOf(t, 'status')}`)
  return 0
}

module.exports = { VOCAB, KEYS, PlanError, parsePlan, entryOf, textOf, taskNodes, taskNode, readyTasks, checkPlan, findPlans, cmdPlan }

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
  taskStatus: ['todo', 'doing', 'done', 'blocked'],
  reviewStatus: ['pending', 'running', 'passed', 'stopped'],
  reviewAxis: ['none', 'spec', 'code'],
  verificationStatus: ['pending', 'running', 'reported', 'accepted', 'blocked'],
}

// The keys the schema knows, per object. Anything else is a note, and its value is not descended
// into: an improvised key is somebody's structure, not a typo to be graded.
const KEYS = {
  plan: ['spec', 'status', 'mode', 'worktree', 'goal', 'context', 'tasks', 'review', 'verification'],
  task: ['id', 'goal', 'deps', 'files', 'model', 'interfaces', 'status', 'commit', 'note'],
  review: ['status', 'axis', 'head', 'receipt', 'fixes', 'note'],
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

// Group 2 keeps the blanks between the colon and what follows: when the value is empty they are
// the only thing separating the key from its trailing comment, and a write has to put them back.
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):([ \t]+[\s\S]*)?$/
const ITEM_RE = /^-(?:[ \t]+([\s\S]*))?$/
const BLOCK_RE = /^[>|][-+]?\d*$/

// `comment` is the trailing text after the value, verbatim (including its leading blanks), or ''
// when there is none — a write reuses it untouched instead of rescanning the line for `#`.
const scalar = (line, endLine, text, comment = '') => ({ kind: 'scalar', line, endLine, text, comment })

const spaceIndent = raw => /^[ ]*/.exec(raw)[0].length

// For a line whose columns carry structure. A tab there is refused; inside a block scalar's body it
// is text the scalar carries, so those lines are measured with spaceIndent instead.
function indentOf(raw, lineNo) {
  const m = spaceIndent(raw)
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
    // An empty value has zero extent, so everything past the colon is the comment.
    return scalar(keyLine, keyLine, null, head.startsWith('#') ? rest : '')
  }
  if (head[0] === '>' || head[0] === '|') return parseBlockScalar(st, head, keyIndent, keyLine)
  if (head[0] === '[') return parseInlineSeq(head, keyLine)
  if (head[0] === '{') throw new PlanError('a flow mapping is not part of the plan shape', keyLine)
  const { value, comment } = decodeScalar(head, keyLine)
  return scalar(keyLine, keyLine, value, comment)
}

function parseBlockScalar(st, head, keyIndent, keyLine) {
  const style = head.split(/[ \t]+#/)[0].trim()
  if (!BLOCK_RE.test(style)) throw new PlanError(`"${style}" is not a block scalar header this reader knows`, keyLine)
  // A write collapses the whole span onto the header line, so the header's own comment is the one
  // that has to survive; the style's extent is where it starts.
  const comment = head.slice(style.length)
  const body = []
  // The index just past the last content line, which is also that line's 1-based number.
  let endLine = keyLine
  while (st.i < st.lines.length) {
    const raw = st.lines[st.i]
    // A line at or left of the key's column ends the body; whoever reads it next grades its tab.
    if (raw.trim() !== '' && spaceIndent(raw) <= keyIndent) break
    body.push(raw)
    st.i++
    if (raw.trim() !== '') endLine = st.i
  }
  // Trailing blank lines belong to whatever comes next, not to the scalar.
  while (body.length && body[body.length - 1].trim() === '') body.pop()
  st.i = endLine
  // The body's indent is the first line that has content: an empty one has none to give, and
  // stripping zero columns would hand back prose still carrying its indentation.
  const first = body.findIndex(l => l.trim() !== '')
  const strip = first < 0 ? 0 : spaceIndent(body[first])
  // A content line left of that indent is not this scalar's line and not a key either — YAML rejects
  // the file. Slicing it by the block's indent would cut its first columns off and hand back text
  // nobody wrote.
  const text = body.map((l, n) => {
    if (l.trim() !== '' && spaceIndent(l) < strip) {
      throw new PlanError('this line is indented less than the block scalar it is inside', keyLine + 1 + n)
    }
    return l.slice(strip).trimEnd()
  })
  const folded = style[0] === '>'
  let joined = ''
  for (const [n, l] of text.entries()) {
    if (n === 0) joined = l
    else if (l === '' || text[n - 1] === '') joined += '\n' + l
    else joined += (folded ? ' ' : '\n') + l
  }
  return scalar(keyLine, endLine, joined.replace(/^\n+|\n+$/g, ''), comment)
}

function parseInlineSeq(head, keyLine) {
  // Group 2, verbatim including its leading blanks, is what an append has to put back when it
  // turns this one line into the key line of a block list (decision 11 extended to this shape).
  const m = /^\[([^[\]{}]*)\]([ \t]+#.*)?$/.exec(head)
  if (!m) throw new PlanError('an inline list must open and close on one line, without nesting', keyLine)
  const inner = m[1].trim()
  const items = inner === '' ? [] : inner.split(',').map(s => scalar(keyLine, keyLine, decodeScalar(s.trim(), keyLine).value))
  return { kind: 'seq', line: keyLine, indent: null, inline: true, items, comment: m[2] || '' }
}

// Returns the decoded value and, verbatim, whatever trails it on the line — '' or a run of blanks
// followed by `# ...`. The split is the boundary the value's own grammar already defines (a
// quote's close, or the first run of blanks before `#`), so a write can reuse it exactly instead
// of scanning the raw line for `#` again, which would be fooled by a `#` the value itself contains.
function decodeScalar(s, line) {
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
    const comment = s.slice(i + 1)
    const tail = comment.trim()
    if (tail !== '' && !tail.startsWith('#')) throw new PlanError('trailing text after a quoted value', line)
    return { value: text, comment }
  }
  const m = /[ \t]+#/.exec(s)
  const plain = (m ? s.slice(0, m.index) : s).trim()
  const comment = m ? s.slice(m.index) : ''
  return { value: plain === '' || plain === 'null' || plain === '~' ? null : plain, comment }
}

// A CR is taken off each line here rather than tolerated in every pattern below — it belongs to the
// line ending, not to the key or the value — and `eols` keeps each line's own ending so the write
// path can put back the one that line had. A plan that is LF except for one CRLF line is that file:
// rejoining it with a single ending would rewrite every line no command addressed. `eol` is the
// prevailing one, used only for a line that has to gain an ending it never had.
function parsePlan(text) {
  const raw = text.split('\n')
  const st = { lines: raw.map(l => l.replace(/\r$/, '')), i: 0 }
  const root = parseMap(st, 0)
  if (skipBlank(st)) throw new PlanError('neither a key nor a list item', st.i + 1)
  const eols = raw.map((l, i) => (i === raw.length - 1 ? '' : (l.endsWith('\r') ? '\r\n' : '\n')))
  return { lines: st.lines, eols, eol: text.includes('\r\n') ? '\r\n' : '\n', root }
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

// `ids: null` for a deps that is written as something other than a list: it names a dependency
// this reader cannot enumerate, and reading it as the empty list would call the task ready.
const depsOf = node => {
  const e = entryOf(node, 'deps')
  if (!e) return { line: node.line, ids: [] }
  if (e.value.kind === 'seq') return { line: e.line, ids: e.value.items.map(i => i.text) }
  if (e.value.kind === 'scalar' && e.value.text === null) return { line: e.line, ids: [] }
  return { line: e.line, ids: null }
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
    if (ids === null) throw new PlanError(`task ${textOf(t, 'id')} wrote deps as a value, not a list of task ids`, line)
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
  else if (tasksEntry) {
    for (const item of tasksEntry.value.items) if (item.kind !== 'map') fail(item.line, 'task: not a mapping, so it has no id')
  }

  const tasks = guard(() => taskNodes(doc)) || []
  const ids = new Map()
  for (const t of tasks) {
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
  for (const t of tasks) {
    const d = guard(() => depsOf(t))
    if (d === undefined) continue  // deps has no address; known() reported that above
    const label = guard(() => textOf(t, 'id')) || '?'
    if (d.ids === null) { fail(d.line, `task ${label}: deps is not a list of task ids`); continue }
    for (const dep of d.ids) {
      if (!ids.has(dep)) fail(d.line, `task ${label}: deps names task ${dep}, which this plan does not have`)
    }
  }

  for (const [key, schema, allowed] of [['review', KEYS.review, VOCAB.reviewStatus], ['verification', KEYS.verification, VOCAB.verificationStatus]]) {
    const e = guard(() => entryOf(root, key))
    if (!e || e.value.kind !== 'map') continue
    known(e.value, `${key}.`, schema)
    vocab(e.value, 'status', `${key}.status`, allowed)
  }

  const reviewEntry = guard(() => entryOf(root, 'review'))
  if (reviewEntry && reviewEntry.value.kind === 'map') {
    const review = reviewEntry.value
    vocab(review, 'axis', 'review.axis', VOCAB.reviewAxis, { required: true })
    const stateEntries = Object.fromEntries(['status', 'axis', 'head', 'receipt'].map(key => [key, guard(() => entryOf(review, key))]))
    if (Object.values(stateEntries).every(e => e && e.value.kind === 'scalar')) {
      const status = stateEntries.status.value.text
      const axis = stateEntries.axis.value.text
      const head = stateEntries.head.value.text
      const receipt = stateEntries.receipt.value.text
      if (status === 'running') {
        if (!['spec', 'code'].includes(axis)) fail(stateEntries.axis.line, 'review.axis: running review needs spec or code')
        if (!head) fail(stateEntries.head.line, 'review.head: running review needs the pre-dispatch HEAD')
        if (!receipt) fail(stateEntries.receipt.line, 'review.receipt: running review needs an ignored receipt path')
      } else if (status === 'pending' || status === 'passed') {
        if (axis !== 'none') fail(stateEntries.axis.line, `review.axis: ${status} review needs none`)
        if (head !== null) fail(stateEntries.head.line, `review.head: ${status} review needs null`)
        if (receipt !== null) fail(stateEntries.receipt.line, `review.receipt: ${status} review needs null`)
      }
    }
  }

  const byLine = (a, b) => a.line - b.line
  return { errors: errors.sort(byLine), notes: notes.sort(byLine) }
}

// --- writing -----------------------------------------------------------------------------------
//
// A write replaces exactly the line(s) an existing scalar already occupies — line..endLine, both
// 1-based and both equal for an inline value. There is no path that creates a key or touches a
// mapping/sequence: the four commands below only ever hand resolveEdits the handful of scalar
// fields the write command table allows, so a frozen field never reaches here for lack of a flag
// that names it.

// Whether `key: value` on one line reads back through decodeScalar/parseValue as this exact
// string. Vocabulary words never need it; free text is quoted whenever leaving it bare would
// change what a later read sees (a comment marker, a mapping colon, a leading list dash, the
// literal words a bare `null` reads back as, or a value with a newline in it).
function encodeScalar(value) {
  if (value === null) return 'null'
  const risky = value === ''
    || /^\s|\s$/.test(value)
    || /^(null|~|true|false)$/i.test(value)
    || /^[-?:,[\]{}#&*!|>'"%@`]/.test(value)
    || /:(\s|$)/.test(value)
    || /\s#/.test(value)
    || /\n/.test(value)
  if (!risky) return value
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
  return `"${escaped}"`
}

// The one address a write may land on: an existing scalar entry, found and unambiguous (entryOf
// itself throws for a duplicate key). Anything else — missing, or a mapping/sequence — fails
// before any edit is built, per decision 7: never guess, never invent the key.
function addressOf(node, key, label) {
  const entry = entryOf(node, key)
  if (!entry) throw new PlanError(`${label}: not found, so it cannot be written`, node.line)
  if (entry.value.kind !== 'scalar') throw new PlanError(`${label}: is not a single value, so it cannot be written`, entry.line)
  return entry
}

// Resolves every {key, value, vocab, label} field on one object into a line edit. All addresses
// are found and all vocabularies checked before any edit is returned, so one invalid flag among
// several leaves the whole set unresolved — the caller never sees a partial result to write.
//
// The replacement line reuses everything the original had left of the key rather than rebuilding
// it as indentation: the first key of a task sits on the dash line, where those columns are `- `,
// and spaces there would leave a plan whose tasks are no longer a list.
function resolveEdits(doc, node, fields) {
  const entries = fields.map(f => {
    const entry = addressOf(node, f.key, f.label)
    if (f.vocab && !f.vocab.includes(f.value)) {
      throw new PlanError(`${f.label}: "${f.value}" is not one of ${f.vocab.join(', ')}`, entry.value.line)
    }
    // `note: "x"# keep` closes the quote straight into the comment. Put back after a value that
    // needs no quotes, that comment reads as part of the value, so the boundary cannot be
    // reproduced and the write stops here instead of swallowing the comment.
    if (entry.value.comment !== '' && !/^[ \t]/.test(entry.value.comment)) {
      throw new PlanError(`${f.label}: the trailing comment has no blank before its "#", so it cannot be told apart from the value`, entry.value.line)
    }
    return entry
  })
  return fields.map((f, i) => {
    const entry = entries[i]
    const prefix = doc.lines[entry.line - 1].slice(0, entry.indent)
    // entry.value.comment is whatever trailed the old value, verbatim (decision 11); it is not
    // recomputed here, so a `#` inside the new value can never be mistaken for it.
    const text = `${prefix}${f.key}: ${encodeScalar(f.value)}${entry.value.comment}`
    return { line: entry.value.line, endLine: entry.value.endLine, text }
  })
}

// Splices every edit's line..endLine span down to its replacement — one line for a scalar write,
// or several for an append (`text` as an array). Applied highest line first so an earlier
// multi-line span (a folded scalar collapsing to one line, or a block appended below) cannot shift
// the still-pending addresses below it.
//
// Two edits share a line when an append lands directly above a scalar the same command rewrites
// (`review --status ... --fix ...` on a fixes list that ends just above `status:`). The
// replacement has to go first: an insertion there shifts the line the replacement addressed, which
// would then land on the item just inserted. Ordering by the wider span settles that here rather
// than leaving it to the order the caller happened to build the two edits in.
function applyEdits(lines, edits) {
  const out = lines.slice()
  for (const e of [...edits].sort((a, b) => b.line - a.line || b.endLine - a.endLine)) {
    out.splice(e.line - 1, e.endLine - e.line + 1, ...(Array.isArray(e.text) ? e.text : [e.text]))
  }
  return out
}

// --- appending: the second write shape, an insertion instead of a replacement -------------------
//
// Where resolveEdits lands on a scalar's own span, an append lands after the list's last existing
// line (or, the first time, on the line an empty inline list occupies) and inserts rather than
// replaces. Same edit shape either way — {line, endLine, text} — so applyEdits needs nothing extra
// to carry it, and the caller's atomic temp-file-plus-rename write path is the only one there is.

// The true last physical line of any parsed node, recursing to the last child: a mapping item in a
// list (a task) spans several lines, and inserting after just its first line would land the new
// item's dash in the middle of the old one.
function nodeEndLine(node) {
  if (node.kind === 'scalar') return node.endLine
  if (node.kind === 'map') return node.entries.length ? nodeEndLine(node.entries[node.entries.length - 1].value) : node.line
  if (node.kind === 'seq') return node.items.length ? nodeEndLine(node.items[node.items.length - 1]) : node.line
  return node.line
}

// The step this file already uses from a mapping key to its block child, read off an existing
// block list in the document instead of assumed — the one case with no sibling item of its own to
// copy the indent from is the empty inline list an append is about to convert.
function blockStep(doc) {
  for (const e of doc.root.entries) {
    if (e.value.kind === 'seq' && !e.value.inline && e.value.items.length) {
      return indentOf(doc.lines[e.value.items[0].line - 1], e.value.items[0].line) - e.indent
    }
  }
  return 2
}

// Appends one item to the list at `node[key]`, or fails and builds nothing. `render(itemIndent)`
// returns the new item's line(s) at that indent. `limit` (default unbounded) is `review.fixes`'s
// cap of two.
//
// An inline empty list (`fixes: []`) is the one line an append may rewrite instead of purely
// inserting after: it becomes the key alone, comment kept verbatim, with the new item below it. A
// non-empty inline list has no defined conversion here and is refused rather than guessed at,
// per decision 7 — the template never writes one of these fields that way.
function resolveAppend(doc, node, key, label, render, limit = Infinity) {
  const entry = entryOf(node, key)
  if (!entry) throw new PlanError(`${label}: not found, so it cannot be written`, node.line)
  const seq = entry.value
  if (seq.kind !== 'seq') throw new PlanError(`${label}: is not a list, so it cannot be appended to`, entry.line)
  if (seq.inline && seq.items.length) {
    throw new PlanError(`${label}: is a non-empty inline list; rewrite it as a block list before appending`, entry.line)
  }
  if (seq.items.length >= limit) {
    throw new PlanError(`${label}: already has ${seq.items.length}, the limit is ${limit}`, entry.line)
  }
  if (seq.inline) {
    const itemIndent = entry.indent + blockStep(doc)
    const prefix = doc.lines[entry.line - 1].slice(0, entry.indent)
    const keyLine = `${prefix}${key}:${seq.comment || ''}`
    return { line: entry.line, endLine: entry.line, text: [keyLine, ...render(itemIndent)] }
  }
  const lastLine = nodeEndLine(seq.items[seq.items.length - 1])
  // The list's own column, not the last item's line: a `- ` carrying no key leaves that item's
  // first key a level deeper, and an item written at that column belongs to no list at all.
  return { line: lastLine + 1, endLine: lastLine, text: render(seq.indent) }
}

// The whole file as it will be on disk: the edits spliced in, every line carrying back the ending
// it was read with. The endings splice exactly as the lines do, so the same edit set is replayed
// over them — a new line takes the ending of the last line it replaces, or of the line above an
// insertion, and all sources are read off the original array, which the bottom-up order keeps valid.
// The one line with no ending of its own is the last, when the file did not end in a newline; it
// gains the prevailing one only once an append has put something after it.
function renderPlan(doc, edits) {
  const lines = applyEdits(doc.lines, edits)
  const eols = applyEdits(doc.eols, edits.map(e => {
    const count = Array.isArray(e.text) ? e.text.length : 1
    const source = e.endLine >= e.line ? doc.eols[e.endLine - 1] : doc.eols[e.line - 2]
    return { line: e.line, endLine: e.endLine, text: new Array(count).fill(source ?? doc.eol) }
  }))
  return lines.map((l, i) => l + (i === lines.length - 1 ? eols[i] : eols[i] || doc.eol)).join('')
}

// Same-directory temp file plus rename (decision 8): a process killed mid-write leaves the plan
// exactly as it was, never half-written. A filesystem error here (permission, disk full, a rename
// that cannot land) is turned into a PlanError so it exits through the same clean path as every
// other failure (decision 12) instead of an unhandled rejection — bin/devkit's promise chain has
// no .catch, so anything else thrown here would surface as a crash with a stack trace.
async function writePlanFile(file, text) {
  const dir = path.dirname(file)
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}-${Date.now()}.tmp`)
  try {
    await fsp.writeFile(tmp, text, 'utf8')
    await fsp.rename(tmp, file)
  } catch (e) {
    await fsp.unlink(tmp).catch(() => {})
    throw new PlanError(`could not write the plan: ${e.message}`)
  }
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
    // A directory named *.yaml is not a plan: it counts as a candidate here and then fails as
    // EISDIR wherever it is opened. Every other failure leaves the plan on the list with an unknown
    // status — dropping it would answer an explicit `--plan` with "no such plan", and raising it
    // here would make one unreadable file fail every command on every other plan in the directory.
    // The one command that goes on to need this file reads it again and reports what it hits.
    let status = null
    try {
      status = textOf(parsePlan(await fsp.readFile(file, 'utf8')).root, 'status')
    } catch (e) {
      if (e.code === 'EISDIR') continue
    }
    plans.push({ slug: name.replace(/\.yaml$/, ''), name, file, status })
  }
  return plans
}

// --- the command -------------------------------------------------------------------------------

// `positional` names the arguments that must appear, in order, before any `--flag` — so a write
// command's id/field come first and `--plan` (or any other flag) trails them.
const SUBS = {
  next: { flags: ['--plan'] },
  show: { flags: ['--plan', '--task'] },
  check: { flags: ['--plan'] },
  set: { flags: ['--plan'], positional: ['field', 'value'] },
  task: { flags: ['--plan', '--status', '--commit', '--note'], positional: ['id'] },
  review: { flags: ['--plan', '--status', '--axis', '--head', '--receipt', '--fix', '--note'] },
  context: { flags: ['--plan', '--add'] },
  verification: { flags: ['--plan', '--status', '--report', '--head', '--note'] },
}
const USAGE = `usage: devkit plan <next|show|check|set|task|review|context|verification> [--plan <slug>] ...`

// Two optional commits per wrap-up axis make review.fixes at most four entries.
const FIXES_LIMIT = 4

const scalarItem = value => itemIndent => [`${' '.repeat(itemIndent)}- ${encodeScalar(value)}`]
const nullableFlag = value => value === 'null' ? null : value

function parseFlags(argv, allowed) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (!allowed.includes(argv[i])) return { error: `unexpected argument "${argv[i]}"` }
    if (i + 1 >= argv.length) return { error: `${argv[i]} needs a value` }
    flags[argv[i].slice(2)] = argv[++i]
  }
  return { flags }
}

// Positional arguments first, then flags — same rule the write command table's examples follow
// (`plan task <id> --status ...`). Returns before parseFlags ever sees a positional slot filled by
// a `--something` that ran out of arguments.
function parseArgs(argv, positionalNames, allowedFlags) {
  const positional = []
  let i = 0
  for (; i < positionalNames.length; i++) {
    if (i >= argv.length || argv[i].startsWith('--')) {
      return { error: `needs ${positionalNames.length} argument${positionalNames.length === 1 ? '' : 's'}: ${positionalNames.join(' ')}` }
    }
    positional.push(argv[i])
  }
  const { flags, error } = parseFlags(argv.slice(i), allowedFlags)
  if (error) return { error }
  return { positional, flags }
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
  const { positional, flags, error } = parseArgs(argv.slice(1), SUBS[sub].positional || [], SUBS[sub].flags)
  if (error) { err(`devkit: ${error}\n${USAGE}`); return 1 }

  const root = findRoot(cwd)
  if (!root) { err('devkit: no project root found (looked upwards for .git or .dev-kit)'); return 1 }
  const planDir = path.join(root, PLANS)
  // Listing the directory is the other place the filesystem can refuse (an unreadable plans/),
  // and decision 12 is about the exit path, not about which syscall failed.
  let plans
  try { plans = await findPlans(planDir) } catch (e) { err(`devkit: could not read ${PLANS}/: ${e.message}`); return 1 }
  if (!plans) { err(`devkit: no ${PLANS}/ directory under ${root}`); return 1 }

  let chosen
  if (flags.plan !== undefined) {
    const slug = flags.plan.replace(/\.yaml$/, '')
    // The slug picks one of the files just enumerated, so nothing typed here is ever joined into
    // a path: every candidate came out of readdir and through resolveInside already.
    chosen = plans.find(p => p.slug === slug)
    if (!chosen) { err(`devkit: no plan "${slug}" in ${PLANS}/${plans.length ? ` (have ${plans.map(p => p.slug).join(', ')})` : ''}`); return 1 }
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
    doc = parsePlan(await fsp.readFile(chosen.file, 'utf8'))
  } catch (e) {
    if (e instanceof PlanError) return fail(e)
    // The chosen plan is the one file whose read has to be reported: it may have been unreadable
    // when it was listed, or gone since (decision 12's exit path, whichever syscall failed).
    err(`devkit: could not read ${name}: ${e.message}`)
    return 1
  }

  const save = async edits => writePlanFile(chosen.file, renderPlan(doc, edits))

  try {
    if (sub === 'next') {
      // One line per ready task: a goal folded across paragraphs reads back with those newlines in
      // it, and printed as they are the second paragraph reads as another task id.
      for (const t of readyTasks(doc)) out(`${t.id}  ${t.goal === null ? '' : t.goal.replace(/\s*\n\s*/g, ' ')}`)
      return 0
    }
    if (sub === 'show') return showPlan(doc, chosen, flags, out, err)
    if (sub === 'check') {
      const { errors, notes } = checkPlan(doc)
      for (const n of notes) out(`${name}:${n.line}: note: ${n.message}`)
      for (const e of errors) err(`${name}:${e.line}: ${e.message}`)
      return errors.length ? 1 : 0
    }
    if (sub === 'set') {
      const [field, value] = positional
      const vocabs = { status: VOCAB.status, mode: VOCAB.mode }
      if (!Object.prototype.hasOwnProperty.call(vocabs, field)) {
        err(`devkit: plan set needs "status" or "mode", not "${field}"\n${USAGE}`)
        return 1
      }
      await save(resolveEdits(doc, doc.root, [{ key: field, value, vocab: vocabs[field], label: field }]))
      return 0
    }
    if (sub === 'task') {
      const [id] = positional
      const task = taskNode(doc, id)
      if (!task) { err(`devkit: ${name}: no task with id ${id}`); return 1 }
      const fields = []
      if (flags.status !== undefined) fields.push({ key: 'status', value: flags.status, vocab: VOCAB.taskStatus, label: `task ${id}: status` })
      if (flags.commit !== undefined) fields.push({ key: 'commit', value: flags.commit, vocab: null, label: `task ${id}: commit` })
      if (flags.note !== undefined) fields.push({ key: 'note', value: flags.note, vocab: null, label: `task ${id}: note` })
      if (!fields.length) { err(`devkit: plan task needs --status, --commit or --note\n${USAGE}`); return 1 }
      await save(resolveEdits(doc, task, fields))
      return 0
    }
    if (sub === 'review') {
      const entry = entryOf(doc.root, 'review')
      if (!entry) { err(`devkit: ${name}: review: not found`); return 1 }
      if (entry.value.kind !== 'map') throw new PlanError('review: is not an object, so its fields cannot be written', entry.line)
      const vocabs = { status: VOCAB.reviewStatus, axis: VOCAB.reviewAxis, head: null, receipt: null, note: null }
      const fields = Object.keys(vocabs)
        .filter(key => flags[key] !== undefined)
        .map(key => ({ key, value: ['head', 'receipt', 'note'].includes(key) ? nullableFlag(flags[key]) : flags[key], vocab: vocabs[key], label: `review.${key}` }))
      const edits = fields.length ? resolveEdits(doc, entry.value, fields) : []
      if (flags.fix !== undefined) {
        edits.push(resolveAppend(doc, entry.value, 'fixes', 'review.fixes', scalarItem(flags.fix), FIXES_LIMIT))
      }
      if (!edits.length) { err(`devkit: plan review needs ${Object.keys(vocabs).map(k => `--${k}`).join(', ')} or --fix\n${USAGE}`); return 1 }
      await save(edits)
      return 0
    }
    if (sub === 'context') {
      if (flags.add === undefined) { err(`devkit: plan context needs --add\n${USAGE}`); return 1 }
      await save([resolveAppend(doc, doc.root, 'context', 'context', scalarItem(flags.add))])
      return 0
    }
    if (sub === 'verification') {
      const entry = entryOf(doc.root, 'verification')
      if (!entry) { err(`devkit: ${name}: verification: not found`); return 1 }
      if (entry.value.kind !== 'map') throw new PlanError('verification: is not an object, so its fields cannot be written', entry.line)
      const vocabs = { status: VOCAB.verificationStatus, report: null, head: null, note: null }
      const fields = Object.keys(vocabs)
        .filter(key => flags[key] !== undefined)
        .map(key => ({ key, value: key === 'status' ? flags[key] : nullableFlag(flags[key]), vocab: vocabs[key], label: `verification.${key}` }))
      if (!fields.length) { err(`devkit: plan verification needs ${Object.keys(vocabs).map(k => `--${k}`).join(', ')}\n${USAGE}`); return 1 }
      await save(resolveEdits(doc, entry.value, fields))
      return 0
    }
    // SUBS is what the arguments were accepted against, so a subcommand listed there and dispatched
    // nowhere reaches this line. Returning nothing would make bin/devkit exit 0 on a command that
    // did not run.
    throw new PlanError(`plan ${sub}: no handler for this subcommand`)
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

module.exports = {
  VOCAB, KEYS, SUBS, FIXES_LIMIT, PlanError, parsePlan, entryOf, textOf, taskNodes, taskNode, readyTasks, checkPlan, cmdPlan,
  encodeScalar, resolveEdits, applyEdits, resolveAppend,
}

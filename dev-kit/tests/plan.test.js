'use strict'

// Run: node --test dev-kit/tests/*.test.js
//
// Covers lib/plan.js. There is no YAML parser here and there must not be one, so the reader
// recognises the plan shape by indentation and refuses everything else. The cases that decide
// whether that is honest work rather than a `grep`:
//
//   the folded scalars   `goal: >-` bodies are prose that contains `status: dong` and lines
//                        starting with `- `. A line-matching reader addresses those and edits
//                        someone's note instead of their status.
//   the line numbers     They are the address tasks 2 and 3 write to, so they are asserted
//                        literally against copies of two real plans from this repository.
//   the duplicates       Two `status:` lines in one object have no unique address. Taking the
//                        first match silently writes a field nobody reads.
//   the two levels       An off-vocabulary state value is an error; an improvised key is a note.
//                        Both real plans below are non-conforming, in different ways, and
//                        flagging their extra keys red would make `check` noise nobody reads.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const {
  VOCAB, KEYS, SUBS, FIXES_LIMIT, PlanError, parsePlan, entryOf, textOf, taskNodes, taskNode, readyTasks, checkPlan, cmdPlan,
  encodeScalar, resolveEdits, applyEdits, resolveAppend,
} = require('../lib/plan')

const FIXTURES = path.join(__dirname, 'fixtures', 'plans')
const BIN = path.join(__dirname, '..', 'bin', 'devkit')

const load = name => parsePlan(fs.readFileSync(path.join(FIXTURES, name), 'utf8'))

// macOS puts temp dirs behind /var -> /private/var and the path boundary compares realpaths, so the
// fixture root has to be realpath'd too or every assertion fails for the wrong reason.
const roots = []
function project(plans) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-plan-')))
  roots.push(dir)
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true })
  if (plans) fs.mkdirSync(path.join(dir, '.dev-kit', 'plans'), { recursive: true })
  for (const [slug, fixture] of Object.entries(plans || {})) {
    fs.copyFileSync(path.join(FIXTURES, fixture), path.join(dir, '.dev-kit', 'plans', `${slug}.yaml`))
  }
  return dir
}

async function run(cwd, argv) {
  const out = []
  const err = []
  const code = await cmdPlan(argv, { cwd, out: s => out.push(s), err: s => err.push(s) })
  return { code, out: out.join('\n'), err: err.join('\n') }
}

test.after(() => { for (const d of roots) fs.rmSync(d, { recursive: true, force: true }) })

// --- the vocabulary is one source, and it is the one writing-plans publishes ------------------

test('the vocabulary matches the plan template in writing-plans', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'writing-plans', 'SKILL.md'), 'utf8')
  // The template's five state lines, in file order: plan status, mode, task status, review,
  // verification. Reading them here is what fails when the skill's vocabulary moves and the CLI
  // starts calling a legal value an error.
  const found = [...skill.matchAll(/^\s*(?:status|mode):\s+\S+\s+#\s*(.+)$/gm)]
    .map(m => m[1].split(';')[0].split(/[→|]/).map(s => s.trim()).filter(s => /^[a-z]+$/.test(s)))
  assert.deepEqual(found, [VOCAB.status, VOCAB.mode, VOCAB.taskStatus, VOCAB.reviewStatus, VOCAB.verificationStatus])
})

test('the schema keys and the fixes cap match the plan template in writing-plans', () => {
  // KEYS decides what `check` calls an improvised key and FIXES_LIMIT what `review --fix` refuses;
  // both are copies of the same template, so a key added there and not here turns every freshly
  // written conforming plan into a schema note.
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'writing-plans', 'SKILL.md'), 'utf8')
  const template = /```yaml\n([\s\S]*?)```/.exec(skill)[1]
  const doc = parsePlan(template)
  assert.deepEqual(doc.root.entries.map(e => e.key), KEYS.plan)
  assert.deepEqual(taskNodes(doc)[0].entries.map(e => e.key), KEYS.task)
  assert.deepEqual(entryOf(doc.root, 'review').value.entries.map(e => e.key), KEYS.review)
  assert.deepEqual(entryOf(doc.root, 'verification').value.entries.map(e => e.key), KEYS.verification)
  assert.equal({ one: 1, two: 2, three: 3 }[/fixes:.*#\s*up to (\w+) wrap-up fixer SHAs/.exec(skill)[1]], FIXES_LIMIT)
})

// --- addressing --------------------------------------------------------------------------------

test('every key of a 493-line real plan is addressed by its own line', () => {
  const doc = load('2026-08-01-dev-kit-evals.yaml')
  assert.equal(entryOf(doc.root, 'status').line, 2)
  assert.equal(entryOf(doc.root, 'status').value.text, 'running')
  assert.equal(entryOf(doc.root, 'mode').value.text, 'subagent')
  assert.equal(entryOf(doc.root, 'delivery_caveats').line, 453)

  const review = entryOf(doc.root, 'review').value
  assert.equal(entryOf(review, 'status').line, 465)
  assert.equal(entryOf(review, 'status').value.text, 'findings')
  assert.equal(entryOf(review, 'wrapup_spec').line, 466)
  assert.equal(entryOf(review, 'status_note').line, 474)
  assert.equal(entryOf(review, 'fixes').line, 475)

  const verification = entryOf(doc.root, 'verification').value
  assert.equal(entryOf(verification, 'status').line, 490)
  assert.equal(entryOf(verification, 'status').value.text, 'pending')

  const tasks = taskNodes(doc)
  assert.equal(tasks.length, 30)
  assert.equal(tasks[0].line, 42)
  assert.equal(entryOf(tasks[27], 'status').line, 415)
  assert.equal(entryOf(tasks[27], 'status').value.text, 'doing')
})

test('a 106-line real plan addresses the keys it invented as well as the ones it kept', () => {
  const doc = load('2026-07-31-pi-subagent-integration.yaml')
  const review = entryOf(doc.root, 'review').value
  assert.equal(entryOf(review, 'status').line, 95)
  assert.equal(entryOf(review, 'status').value.text, 'done')
  assert.equal(entryOf(review, 'fix').line, 96)
  assert.equal(entryOf(review, 'fixes'), null)
  const verification = entryOf(doc.root, 'verification').value
  assert.equal(entryOf(verification, 'status').line, 99)
  assert.equal(entryOf(verification, 'status').value.text, 'passed')
  // The folded note under verification ends the file; its body is not four more top-level keys.
  assert.match(entryOf(verification, 'note').value.text, /^Fresh local-path install.*created\.$/)
})

test('a folded scalar body is prose, never a key', () => {
  const doc = load('conforming.yaml')
  const task = taskNodes(doc)[0]
  assert.equal(entryOf(task, 'status').line, 20)
  assert.equal(entryOf(task, 'status').value.text, 'done')
  assert.match(entryOf(task, 'note').value.text, /status: dong here/)
  assert.match(entryOf(task, 'note').value.text, /- files: \[nope\] is prose too$/)
  assert.equal(entryOf(task, 'files').value.items.map(i => i.text).join(), 'src/a.js')
  // The folded goal reads back as one line, which is what `next` prints.
  assert.equal(entryOf(doc.root, 'goal').value.text, 'One observable finish condition, folded across two lines.')
})

test('a block scalar whose body opens with an empty line is not indented by it', () => {
  // The body's indentation is stripped by the first content line's column; an empty first line has
  // none, and reading it as the whole body's indent hands back prose that is still indented.
  const doc = parsePlan([
    'status: running',
    'goal: |',
    '',
    '  line one',
    '  line two',
    'tasks:',
    '  - id: 1',
    '    status: todo',
  ].join('\n'))
  assert.equal(entryOf(doc.root, 'goal').value.text, 'line one\nline two')
})

// A tab past a body line's indentation is text the scalar carries, and a YAML parser reads it back
// as part of the value. Refusing it makes a plan uncommandable by every subcommand, the read-only
// ones included, and this CLI has nothing that could repair it.
test('a tab inside a block scalar body is content, not indentation', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    note: |-',
    '      a command:',
    '      \tdevkit plan next',
    '    deps: []',
  ].join('\n'))
  const task = taskNodes(doc)[0]
  assert.equal(entryOf(task, 'note').value.text, 'a command:\n\tdevkit plan next')
  // The body ended where the indentation says it did, so the key after it keeps its own line.
  assert.equal(entryOf(task, 'deps').line, 8)
})

test('a tab in the columns that carry the structure is still refused, on its line', () => {
  for (const [lines, at] of [
    [['status: running', 'tasks:', '\t- id: 1'], 3],
    [['status: running', 'tasks:', '  - id: 1', '    note: |-', '      body', '\tstatus: todo'], 6],
  ]) {
    assert.throws(() => parsePlan(lines.join('\n')), err => {
      assert.ok(err instanceof PlanError)
      assert.equal(err.line, at)
      return true
    })
  }
})

// A body line left of the block's own indentation ends the scalar and then belongs to nothing, which
// a YAML parser rejects outright. Slicing it by the block's indent hands back text nobody wrote.
test('a block scalar body line indented less than the block itself is refused, not cut short', () => {
  assert.throws(() => parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    note: >-',
    '        deep line',
    '      shallow line',
    '    deps: []',
  ].join('\n')), err => {
    assert.ok(err instanceof PlanError)
    assert.equal(err.line, 7)
    return true
  })
})

test('a trailing comment is not part of the value', () => {
  const doc = load('conforming.yaml')
  assert.equal(entryOf(doc.root, 'status').value.text, 'running')
  assert.equal(entryOf(doc.root, 'mode').value.text, 'subagent')
})

test('inline and block sequences both read as lists, each item on its own line', () => {
  const doc = load('conforming.yaml')
  const [, two] = taskNodes(doc)
  const deps = entryOf(two, 'deps').value
  assert.deepEqual(deps.items.map(i => i.text), ['1'])
  assert.equal(deps.inline, true)
  const files = entryOf(two, 'files').value
  assert.deepEqual(files.items.map(i => i.text), ['src/b.js', 'dev-kit/tests/b.test.js'])
  assert.deepEqual(files.items.map(i => i.line), [29, 30])
  assert.equal(files.inline, false)
  assert.deepEqual(entryOf(taskNodes(doc)[0], 'deps').value.items, [])
  assert.equal(entryOf(taskNodes(doc)[0], 'commit').value.text, 'abc1234')
  assert.equal(entryOf(two, 'commit').value.text, null)
})

test('a key written twice in one object has no address, and the first match is not it', () => {
  const doc = load('duplicate-keys.yaml')
  const task = taskNodes(doc)[0]
  assert.throws(() => entryOf(task, 'status'), err => {
    assert.ok(err instanceof PlanError)
    assert.match(err.message, /status/)
    assert.match(err.message, /15/)
    assert.match(err.message, /17/)
    return true
  })
})

test('a shape the reader does not know fails instead of guessing', () => {
  assert.throws(() => load('unknown-shape.yaml'), err => {
    assert.ok(err instanceof PlanError)
    assert.equal(err.line, 8)
    return true
  })
})

// --- ready -------------------------------------------------------------------------------------

test('ready is status todo with every dep done', () => {
  const doc = load('conforming.yaml')
  // 1 is done, 2 is todo behind it, 3 is todo behind 2.
  assert.deepEqual(readyTasks(doc).map(t => t.id), ['2'])
  assert.equal(readyTasks(doc)[0].goal, 'Second slice')
})

test('no ready task is a normal state, not an error', () => {
  assert.deepEqual(readyTasks(load('2026-08-01-dev-kit-evals.yaml')), [])
  assert.deepEqual(readyTasks(load('2026-07-31-pi-subagent-integration.yaml')), [])
})

test('a dep on a task nobody cut fails and says which', () => {
  assert.throws(() => readyTasks(load('dangling-deps.yaml')), err => {
    assert.ok(err instanceof PlanError)
    assert.equal(err.line, 22)
    assert.match(err.message, /7/)
    return true
  })
})

test('a deps that is not a list is refused, not read as no deps', () => {
  // `deps: 1` names a dependency. Reading it as the empty list calls task 2 ready while task 1
  // is unfinished, which is the one answer `next` exists to get right.
  assert.throws(() => readyTasks(load('off-shape-tasks.yaml')), err => {
    assert.ok(err instanceof PlanError)
    assert.equal(err.line, 22)
    return true
  })
})

// --- check -------------------------------------------------------------------------------------

const lines = list => list.map(p => p.line)

test('check passes a conforming plan silently', () => {
  const { errors, notes } = checkPlan(load('conforming.yaml'))
  assert.deepEqual(errors, [])
  assert.deepEqual(notes, [])
})

test('check calls an off-vocabulary state value an error, on its line', () => {
  const { errors, notes } = checkPlan(load('2026-07-31-pi-subagent-integration.yaml'))
  assert.deepEqual(lines(errors), [95, 99])
  assert.match(errors[0].message, /review\.status/)
  assert.match(errors[0].message, /done/)
  assert.match(errors[0].message, /passed/)  // the vocabulary it should have used
  assert.match(errors[1].message, /verification\.status/)
  assert.deepEqual(lines(notes), [96])
  assert.match(notes[0].message, /fix/)
})

test('check calls an improvised key a note and does not descend into it', () => {
  const { errors, notes } = checkPlan(load('2026-08-01-dev-kit-evals.yaml'))
  assert.deepEqual(lines(errors), [465])
  // delivery_caveats, wrapup_spec, status_note — and nothing from inside them or from the
  // hand-shaped entries under review.fixes.
  assert.deepEqual(lines(notes), [453, 466, 474])
})

test('check reports a missing required key against the object that lacks it', () => {
  const { errors } = checkPlan(load('missing-keys.yaml'))
  assert.deepEqual(lines(errors), [1, 8, 11])
  assert.match(errors[0].message, /status/)
  assert.match(errors[1].message, /status/)
  assert.match(errors[2].message, /id/)
})

test('check reports a duplicated key and a duplicated task id', () => {
  const { errors } = checkPlan(load('duplicate-keys.yaml'))
  assert.deepEqual(lines(errors), [17, 28])
  assert.match(errors[0].message, /status/)
  assert.match(errors[1].message, /id 2/)
})

test('check reports a dangling dep as an error', () => {
  const { errors } = checkPlan(load('dangling-deps.yaml'))
  assert.deepEqual(lines(errors), [22])
})

test('one unaddressable task does not swallow the rest of the report', () => {
  // A scalar deps on task 2, a deps written twice on task 3, a list item that is not a task at
  // all, and an off-vocabulary value after all three: check is the whole-file pass, so the ones
  // it cannot address must be reported rather than end it.
  const { errors, notes } = checkPlan(load('off-shape-tasks.yaml'))
  assert.deepEqual(lines(errors), [22, 35, 39, 46])
  assert.deepEqual(notes, [])
  assert.match(errors[0].message, /deps/)
  assert.match(errors[1].message, /deps/)
  assert.match(errors[3].message, /verification\.status/)
})

// --- writing: encode / address / splice, as pure functions -------------------------------------

test('encodeScalar leaves a plain value unquoted and quotes what would misparse', () => {
  assert.equal(encodeScalar('f5401dc'), 'f5401dc')
  assert.equal(encodeScalar(null), 'null')
  // A bare quote or backslash mid-string is not ambiguous to this reader (decodeScalar only takes
  // the quoted path when the value *starts* with one), so it is left as-is.
  assert.equal(encodeScalar('a "quote" and a \\ backslash, unquoted'), 'a "quote" and a \\ backslash, unquoted')
  assert.equal(encodeScalar('done: yes'), '"done: yes"')
  assert.equal(encodeScalar('- looks like a list item'), '"- looks like a list item"')
  assert.equal(encodeScalar('null'), '"null"')
  assert.equal(encodeScalar(''), '""')
  // Quoting is triggered by the colon, and once quoted the embedded quote and backslash must be escaped.
  assert.equal(encodeScalar('note: has a "quote" and a \\ backslash'), '"note: has a \\"quote\\" and a \\\\ backslash"')
  assert.equal(encodeScalar('line one\nline two'), '"line one\\nline two"')
})

test('resolveEdits addresses an inline scalar by its one line and keeps its trailing comment', () => {
  const doc = load('conforming.yaml')
  const edits = resolveEdits(doc, doc.root, [{ key: 'status', value: 'done', vocab: VOCAB.status, label: 'status' }])
  assert.deepEqual(edits, [{ line: 2, endLine: 2, text: 'status: done               # draft → ready → running → done | stopped' }])
})

test('resolveEdits leaves a value with no trailing comment exactly as before', () => {
  const doc = load('conforming.yaml')
  const two = taskNodes(doc)[1]
  const edits = resolveEdits(doc, two, [{ key: 'status', value: 'doing', vocab: VOCAB.taskStatus, label: 'task 2: status' }])
  assert.deepEqual(edits, [{ line: 33, endLine: 33, text: '    status: doing' }])
})

test('resolveEdits finds the comment boundary from the value\'s parsed extent, not by scanning for #', () => {
  // The note is a quoted value that itself contains "#", followed by a real trailing comment.
  // A write that rescanned this raw line for "#" would cut inside the quoted value; the boundary
  // has to come from where decodeScalar already knows the quote closes.
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    note: "issue #42 needs a fix"   # filed by triage',
    '    deps: []',
  ].join('\n'))
  const task = taskNodes(doc)[0]
  const edits = resolveEdits(doc, task, [{ key: 'note', value: 'still open', vocab: null, label: 'task 1: note' }])
  assert.deepEqual(edits, [{ line: 5, endLine: 5, text: '    note: still open   # filed by triage' }])
})

test('resolveEdits leaves no spurious comment when a quoted value containing # has none of its own', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    note: "issue #42 needs a fix"',
    '    deps: []',
  ].join('\n'))
  const task = taskNodes(doc)[0]
  const edits = resolveEdits(doc, task, [{ key: 'note', value: 'still open', vocab: null, label: 'task 1: note' }])
  assert.deepEqual(edits, [{ line: 5, endLine: 5, text: '    note: still open' }])
})

test('resolveEdits keeps the comment on a key whose value is empty', () => {
  // `mode:` with nothing but a legend after it. The value's extent is empty, so everything past
  // the colon is the comment — dropping it deletes the legend the write was supposed to leave alone.
  const doc = parsePlan([
    'status: running',
    'mode:   # subagent | inline',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
  ].join('\n'))
  const edits = resolveEdits(doc, doc.root, [{ key: 'mode', value: 'subagent', vocab: VOCAB.mode, label: 'mode' }])
  assert.deepEqual(edits, [{ line: 2, endLine: 2, text: 'mode: subagent   # subagent | inline' }])
})

test('resolveEdits keeps the comment on the block scalar header it collapses', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    note: >-  # filed by triage',
    '      some folded prose',
    '      over two lines',
    '    deps: []',
  ].join('\n'))
  const task = taskNodes(doc)[0]
  const edits = resolveEdits(doc, task, [{ key: 'note', value: 'still open', vocab: null, label: 'task 1: note' }])
  assert.deepEqual(edits, [{ line: 5, endLine: 7, text: '    note: still open  # filed by triage' }])
})

test('resolveEdits refuses a line whose comment has no blank before its #', () => {
  // `"x"# keep` closes the quote straight into the `#`. Re-emitted after a value that needs no
  // quotes the comment would read back as part of the value, so the boundary is not reproducible:
  // fail without writing rather than silently swallow the comment into the note.
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    note: "issue 42"# filed by triage',
    '    deps: []',
  ].join('\n'))
  const task = taskNodes(doc)[0]
  assert.throws(() => resolveEdits(doc, task, [{ key: 'note', value: 'still open', vocab: null, label: 'task 1: note' }]), err => {
    assert.ok(err instanceof PlanError)
    assert.equal(err.line, 5)
    return true
  })
})

test('resolveEdits addresses a folded block scalar by its whole span, in a real plan', () => {
  const doc = load('2026-08-01-dev-kit-evals.yaml')
  const nine = taskNodes(doc).find(t => textOf(t, 'id') === '9')
  const edits = resolveEdits(doc, nine, [{ key: 'note', value: 'Recut: superseding the prior note.', vocab: null, label: 'task 9: note' }])
  assert.deepEqual(edits, [{ line: 147, endLine: 152, text: '    note: "Recut: superseding the prior note."' }])
})

test('resolveEdits fails on an off-vocabulary value and addresses nothing', () => {
  const doc = load('conforming.yaml')
  assert.throws(() => resolveEdits(doc, doc.root, [{ key: 'status', value: 'dong', vocab: VOCAB.status, label: 'status' }]), err => {
    assert.ok(err instanceof PlanError)
    assert.match(err.message, /status/)
    assert.match(err.message, /dong/)
    return true
  })
})

test('resolveEdits fails when the key is not in the object', () => {
  const doc = load('missing-keys.yaml')
  assert.throws(() => resolveEdits(doc, doc.root, [{ key: 'status', value: 'running', vocab: VOCAB.status, label: 'status' }]), err => {
    assert.ok(err instanceof PlanError)
    assert.match(err.message, /not found/)
    return true
  })
})

test('resolveEdits fails when the key is written twice, same as entryOf', () => {
  const doc = load('duplicate-keys.yaml')
  const task = taskNodes(doc)[0]
  assert.throws(() => resolveEdits(doc, task, [{ key: 'status', value: 'done', vocab: VOCAB.taskStatus, label: 'task 1: status' }]), PlanError)
})

test('resolveEdits validates every field before addressing any, so one bad value blocks the whole set', () => {
  const doc = load('conforming.yaml')
  const two = taskNodes(doc)[1]
  assert.throws(() => resolveEdits(doc, two, [
    { key: 'status', value: 'bogus', vocab: VOCAB.taskStatus, label: 'task 2: status' },
    { key: 'commit', value: 'deadbeef', vocab: null, label: 'task 2: commit' },
  ]), PlanError)
})

test('applyEdits replaces only the addressed lines, leaving the rest untouched', () => {
  const doc = load('conforming.yaml')
  const out = applyEdits(doc.lines, [{ line: 2, endLine: 2, text: 'status: done' }])
  assert.equal(out[1], 'status: done')
  assert.deepEqual(out.slice(0, 1), doc.lines.slice(0, 1))
  assert.deepEqual(out.slice(2), doc.lines.slice(2))
})

test('applyEdits folds a multi-line span down to the one new line, shifting what follows', () => {
  const doc = load('2026-08-01-dev-kit-evals.yaml')
  const out = applyEdits(doc.lines, [{ line: 147, endLine: 152, text: '    note: "short now"' }])
  assert.equal(out[146], '    note: "short now"')
  assert.deepEqual(out.slice(0, 146), doc.lines.slice(0, 146))
  assert.deepEqual(out.slice(147), doc.lines.slice(152))
})

// `review --status ... --fix ...` on a plan whose fixes list ends directly above `status:` gives
// both edits the same `line`: the replacement rewrites that line, the insertion goes in front of
// it. Insertion first shifts the line the replacement addressed, and the replacement then lands on
// the item just inserted — one `status:` written twice, the fix gone. The order must not depend on
// which one the caller happened to push first.
test('applyEdits puts a same-line replacement before an insertion, whichever order it is handed', () => {
  const lines = ['review:', '  fixes:', '    - abc1234', '  status: pending']
  const replace = { line: 4, endLine: 4, text: '  status: passed' }
  const insert = { line: 4, endLine: 3, text: ['    - def5678'] }
  const expected = ['review:', '  fixes:', '    - abc1234', '    - def5678', '  status: passed']
  assert.deepEqual(applyEdits(lines, [replace, insert]), expected)
  assert.deepEqual(applyEdits(lines, [insert, replace]), expected)
})

// --- resolveAppend: the second write shape, an insertion instead of a replacement --------------

test('resolveAppend converts an inline empty list into block form, on the key\'s own line', () => {
  const doc = load('conforming.yaml')
  const review = entryOf(doc.root, 'review').value
  const edit = resolveAppend(doc, review, 'fixes', 'review.fixes', i => [`${' '.repeat(i)}- abc1234`])
  assert.deepEqual(edit, { line: 48, endLine: 48, text: ['  fixes:', '    - abc1234'] })
})

test('resolveAppend keeps the trailing comment of the [] line it converts', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
    '',
    'review:',
    '  status: pending',
    '  fixes: []                   # up to two wrap-up fixer SHAs',
  ].join('\n'))
  const review = entryOf(doc.root, 'review').value
  const edit = resolveAppend(doc, review, 'fixes', 'review.fixes', i => [`${' '.repeat(i)}- abc1234`])
  assert.deepEqual(edit, {
    line: 9,
    endLine: 9,
    text: ['  fixes:                   # up to two wrap-up fixer SHAs', '    - abc1234'],
  })
})

test('resolveAppend inserts after the last item of an already-populated block list', () => {
  const doc = load('conforming.yaml')
  const edit = resolveAppend(doc, doc.root, 'context', 'context', i => [`${' '.repeat(i)}- "a new fact"`])
  assert.deepEqual(edit, { line: 12, endLine: 11, text: ['  - "a new fact"'] })
})

test('resolveAppend finds the true end of a multi-line mapping item, not just its first line', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
    '',
    'attachments:',
    '  - kind: "log"',
    '    ref: aaa1111',
    '',
    'review:',
    '  status: pending',
  ].join('\n'))
  const edit = resolveAppend(doc, doc.root, 'attachments', 'attachments', i => [`${' '.repeat(i)}- kind: "patch"`])
  assert.deepEqual(edit, { line: 10, endLine: 9, text: ['  - kind: "patch"'] })
})

// A `- ` carrying no key puts the item's first key on the next line, two columns in from the dash,
// and that key's line is the item node's own line. An indent read off there writes a dash the list
// does not own: the append still exits 0, and every later read of the plan fails on that line.
test('resolveAppend indents a new item by its list, not by a bare-dash item\'s first key', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
    '',
    'attachments:',
    '  -',
    '    kind: "log"',
    '    ref: aaa1111',
  ].join('\n'))
  const edit = resolveAppend(doc, doc.root, 'attachments', 'attachments', i => [`${' '.repeat(i)}- kind: "patch"`])
  assert.deepEqual(edit, { line: 11, endLine: 10, text: ['  - kind: "patch"'] })
})

test('resolveAppend refuses once the list already holds the given limit', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
    '',
    'review:',
    '  status: pending',
    '  fixes:',
    '    - abc1234',
    '    - def5678',
  ].join('\n'))
  const review = entryOf(doc.root, 'review').value
  assert.throws(() => resolveAppend(doc, review, 'fixes', 'review.fixes', i => [`${' '.repeat(i)}- deadbee`], 2), err => {
    assert.ok(err instanceof PlanError)
    assert.match(err.message, /review\.fixes/)
    return true
  })
})

test('resolveAppend fails when the key is not in the object', () => {
  const doc = load('missing-keys.yaml')
  assert.throws(() => resolveAppend(doc, doc.root, 'context', 'context', i => [`${' '.repeat(i)}- "x"`]), err => {
    assert.ok(err instanceof PlanError)
    assert.match(err.message, /not found/)
    return true
  })
})

// A folded item's dash line is not where it ends. Inserting after that line alone would put the
// new dash inside somebody's prose.
test('resolveAppend inserts after the last line of a folded item, not after its dash line', () => {
  const doc = parsePlan([
    'status: running',
    'context:',
    '  - >-',
    '    a verified fact folded',
    '    across two lines',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
  ].join('\n'))
  const edit = resolveAppend(doc, doc.root, 'context', 'context', i => [`${' '.repeat(i)}- "next"`])
  assert.deepEqual(edit, { line: 6, endLine: 5, text: ['  - "next"'] })
})

test('resolveAppend refuses a key that is present but is not a list', () => {
  const doc = parsePlan(['status: running', 'context:', 'tasks:', '  - id: 1', '    status: todo'].join('\n'))
  assert.throws(() => resolveAppend(doc, doc.root, 'context', 'context', i => [`${' '.repeat(i)}- "x"`]), err => {
    assert.ok(err instanceof PlanError)
    assert.match(err.message, /not a list/)
    return true
  })
})

// Only `[]` has a conversion the append is allowed to make. A hand-written `[a, b]` would have to
// be rewritten line for line, and guessing at that is decision 7's "never guess" — but the refusal
// has to say which shape it is refusing, or there is nothing for the caller to act on.
test('resolveAppend names the shape when it refuses a non-empty inline list', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    'review:',
    '  status: pending',
    '  fixes: [abc1234]',
  ].join('\n'))
  const review = entryOf(doc.root, 'review').value
  assert.throws(() => resolveAppend(doc, review, 'fixes', 'review.fixes', i => [`${' '.repeat(i)}- deadbee`], 2), err => {
    assert.ok(err instanceof PlanError)
    assert.match(err.message, /inline list/)
    assert.equal(err.line, 7)
    return true
  })
})

// --- writing: the byte-preservation property, on real plans ------------------------------------

// Every line outside the addressed span must come back identical. That is the one property this
// whole slice exists to prove, so it is asserted against the two real plans in this repo, not only
// a small hand-made fixture.
function assertOnlySpanChanged(before, after, fromLine, removedLines, newLine) {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const start = fromLine - 1
  assert.deepEqual(afterLines.slice(0, start), beforeLines.slice(0, start), 'a line before the write changed')
  assert.equal(afterLines[start], newLine)
  assert.deepEqual(afterLines.slice(start + 1), beforeLines.slice(start + removedLines), 'a line after the write changed')
}

test('writing an inline scalar in the 493-line plan changes only that line', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, '2026-08-01-dev-kit-evals.yaml'), 'utf8')
  const cwd = project({ evals: '2026-08-01-dev-kit-evals.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'evals.yaml')
  const { code, err } = await run(cwd, ['task', '1', '--status', 'todo', '--plan', 'evals'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assertOnlySpanChanged(before, after, 50, 1, '    status: todo')
})

test('writing the folded note of task 9 in the 493-line plan preserves every other folded scalar', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, '2026-08-01-dev-kit-evals.yaml'), 'utf8')
  const cwd = project({ evals: '2026-08-01-dev-kit-evals.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'evals.yaml')
  const { code, err } = await run(cwd, ['task', '9', '--note', 'Recut: superseded.', '--plan', 'evals'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assertOnlySpanChanged(before, after, 147, 6, '    note: "Recut: superseded."')
})

test('appending a context fact in the 493-line plan changes nothing else, folded scalars included', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, '2026-08-01-dev-kit-evals.yaml'), 'utf8')
  const cwd = project({ evals: '2026-08-01-dev-kit-evals.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'evals.yaml')
  const { code, err } = await run(cwd, ['context', '--add', 'Recorded by task 3 of the plan-cli round', '--plan', 'evals'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assertOnlySpanChanged(before, after, 40, 0, '  - Recorded by task 3 of the plan-cli round')
})

test('writing verification.note at the very end of the 106-line plan preserves everything before it', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, '2026-07-31-pi-subagent-integration.yaml'), 'utf8')
  const cwd = project({ pi: '2026-07-31-pi-subagent-integration.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'pi.yaml')
  const { code, err } = await run(cwd, ['verification', '--note', 'Re-verified: after the recut.', '--plan', 'pi'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assertOnlySpanChanged(before, after, 102, 4, '  note: "Re-verified: after the recut."')
})

test('writing the key that sits on a task\'s dash line keeps the "- " that makes it a task', async () => {
  // `- status: todo` puts a writable key in the item column. Rebuilding that column as indentation
  // deletes the dash, and the plan then parses as a mapping with no tasks in it at all.
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'dashed.yaml')
  const before = 'status: running\ntasks:\n  - status: todo\n    id: 1\n    deps: []\n'
  fs.writeFileSync(file, before)
  const { code, err } = await run(cwd, ['task', '1', '--status', 'doing', '--plan', 'dashed'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assert.equal(after, before.replace('- status: todo', '- status: doing'))
  assert.equal(taskNodes(parsePlan(after)).length, 1)
})

test('writing the key on a task\'s dash line keeps both the "- " and that line\'s comment', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'dashed.yaml')
  const before = 'status: running\ntasks:\n  - status: todo   # todo → doing → done | blocked\n    id: 1\n    deps: []\n'
  fs.writeFileSync(file, before)
  const { code, err } = await run(cwd, ['task', '1', '--status', 'doing', '--plan', 'dashed'])
  assert.equal(err, '')
  assert.equal(code, 0)
  assert.equal(fs.readFileSync(file, 'utf8'), before.replace('- status: todo ', '- status: doing '))
})

test('a write lands through a temp file and rename, leaving no stray file behind', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  // The rename swaps in a file created beside the old one, so the name points at a different inode
  // afterwards. An in-place overwrite — the shape that can leave half a plan on disk — keeps it.
  const before = fs.statSync(file).ino
  const { code } = await run(cwd, ['set', 'status', 'done', '--plan', 'live'])
  assert.equal(code, 0)
  assert.notEqual(fs.statSync(file).ino, before)
  const names = fs.readdirSync(path.join(cwd, '.dev-kit', 'plans'))
  assert.deepEqual(names, ['live.yaml'])
})

// The reader keeps the line each value sits on, and a write hands those lines back verbatim, so a
// CR at the end of one is part of the file this CLI must give back unchanged.
test('a plan whose lines end in CRLF is read and written back with its line endings intact', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'crlf.yaml')
  const before = ['status: running', 'tasks:', '  - id: 1', '    status: todo', '    deps: []', ''].join('\r\n')
  fs.writeFileSync(file, before)
  const { code, err } = await run(cwd, ['task', '1', '--status', 'doing', '--plan', 'crlf'])
  assert.equal(err, '')
  assert.equal(code, 0)
  assert.equal(fs.readFileSync(file, 'utf8'), before.replace('status: todo', 'status: doing'))
})

// One CRLF line in an otherwise LF file is part of that file. Picking one ending for the whole plan
// and rejoining with it rewrites every line the command never addressed — the byte-preservation
// invariant read the other way round.
test('a plan whose line endings are mixed keeps each line\'s own ending', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'mixed.yaml')
  const before = 'status: running\ntasks:\r\n  - id: 1\n    status: todo\n    deps: []\n'
  fs.writeFileSync(file, before)
  const { code, err } = await run(cwd, ['task', '1', '--status', 'doing', '--plan', 'mixed'])
  assert.equal(err, '')
  assert.equal(code, 0)
  assert.equal(fs.readFileSync(file, 'utf8'), before.replace('status: todo', 'status: doing'))
})

test('an appended line takes the ending of the line it lands after', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'mixed.yaml')
  const before = 'status: running\r\ncontext:\r\n  - one\ntasks:\n  - id: 1\n    status: todo\n    deps: []\n'
  fs.writeFileSync(file, before)
  const { code, err } = await run(cwd, ['context', '--add', 'two', '--plan', 'mixed'])
  assert.equal(err, '')
  assert.equal(code, 0)
  assert.equal(fs.readFileSync(file, 'utf8'), before.replace('  - one\n', '  - one\n  - two\n'))
})

// commented.yaml copies writing-plans/SKILL.md's own template, whose four writable `status:`
// lines all carry a state legend as a trailing comment. Neither real plan fixture has one.
test('writing the plan status in a plan shaped like the template keeps its state legend', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, 'commented.yaml'), 'utf8')
  const cwd = project({ tpl: 'commented.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'tpl.yaml')
  const { code, err } = await run(cwd, ['set', 'status', 'running', '--plan', 'tpl'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assertOnlySpanChanged(before, after, 2, 1, 'status: running                 # draft → ready → running → done | stopped')
})

test('writing a task status in a plan shaped like the template keeps its state legend', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, 'commented.yaml'), 'utf8')
  const cwd = project({ tpl: 'commented.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'tpl.yaml')
  const { code, err } = await run(cwd, ['task', '1', '--status', 'doing', '--plan', 'tpl'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assertOnlySpanChanged(before, after, 17, 1, '    status: doing              # todo → doing → done | blocked')
})

test('writing review.status and verification.status each keep their own state legend', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, 'commented.yaml'), 'utf8')
  const cwd = project({ tpl: 'commented.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'tpl.yaml')
  assert.equal((await run(cwd, ['review', '--status', 'passed', '--plan', 'tpl'])).code, 0)
  assert.equal((await run(cwd, ['verification', '--status', 'running', '--plan', 'tpl'])).code, 0)
  const after = fs.readFileSync(file, 'utf8')
  const afterLines = after.split('\n')
  assert.equal(afterLines[21], '  status: passed             # pending → passed | stopped')
  assert.equal(afterLines[25], '  status: running             # pending → running → reported → accepted | blocked')
  const beforeLines = before.split('\n')
  assert.deepEqual(afterLines.slice(0, 21), beforeLines.slice(0, 21))
  assert.deepEqual(afterLines.slice(22, 25), beforeLines.slice(22, 25))
  assert.deepEqual(afterLines.slice(26), beforeLines.slice(26))
})

// The write path is decision 8's temp-file-plus-rename inside writePlanFile; a filesystem error
// there must exit the same clean way as every other failure (decision 12), not as an unhandled
// rejection — bin/devkit's promise chain has no .catch, so any rejection it sees is a crash.
test('a filesystem error while writing exits cleanly through cmdPlan, and the plan is untouched', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const dir = path.join(cwd, '.dev-kit', 'plans')
  const file = path.join(dir, 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  fs.chmodSync(dir, 0o500)
  try {
    const { code, err } = await run(cwd, ['set', 'status', 'done', '--plan', 'live'])
    assert.equal(code, 1)
    assert.match(err, /^devkit: /)
  } finally {
    fs.chmodSync(dir, 0o700)
  }
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

// The other filesystem error a plan command can hit is enumerating the directory in the first
// place, and decision 12 is about the exit path, not about which syscall failed.
test('a plans directory that cannot be listed fails the same clean way', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const dir = path.join(cwd, '.dev-kit', 'plans')
  fs.chmodSync(dir, 0o300)  // enterable and writable, but readdir gets EACCES
  try {
    const { code, err } = await run(cwd, ['next', '--plan', 'live'])
    assert.equal(code, 1)
    assert.match(err, /^devkit: /)
  } finally {
    fs.chmodSync(dir, 0o700)
  }
})

test('a filesystem error while writing, through the real CLI, prints no stack trace', () => {
  const cwd = project({ live: 'conforming.yaml' })
  const dir = path.join(cwd, '.dev-kit', 'plans')
  const file = path.join(dir, 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  fs.chmodSync(dir, 0o500)
  let caught
  try {
    execFileSync(process.execPath, [BIN, 'plan', 'set', 'status', 'done', '--plan', 'live'], { cwd, encoding: 'utf8', stdio: 'pipe' })
  } catch (e) {
    caught = e
  } finally {
    fs.chmodSync(dir, 0o700)
  }
  assert.ok(caught, 'expected a non-zero exit')
  assert.notEqual(caught.status, 0)
  assert.match(caught.stderr, /^devkit: /)
  assert.doesNotMatch(caught.stderr, /\n\s+at /)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

// --- writing: the commands ------------------------------------------------------------------

test('plan set status writes the plan status, and nothing else', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const { code, out, err } = await run(cwd, ['set', 'status', 'done', '--plan', 'live'])
  assert.equal(err, '')
  assert.equal(out, '')
  assert.equal(code, 0)
  assert.equal(entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'status').value.text, 'done')
})

test('plan set mode writes the plan mode', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const { code } = await run(cwd, ['set', 'mode', 'inline', '--plan', 'live'])
  assert.equal(code, 0)
  assert.equal(entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'mode').value.text, 'inline')
})

test('plan set refuses an off-vocabulary value and writes nothing', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['set', 'status', 'dong', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /dong/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('plan set refuses a field it does not know, frozen fields included', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const { code, err } = await run(cwd, ['set', 'goal', 'a new goal', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /goal/)
})

test('plan task writes status, commit and note together', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const { code, err } = await run(cwd, ['task', '2', '--status', 'doing', '--commit', 'f5401dc', '--note', 'looks good', '--plan', 'live'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const task = taskNode(parsePlan(fs.readFileSync(file, 'utf8')), '2')
  assert.equal(textOf(task, 'status'), 'doing')
  assert.equal(textOf(task, 'commit'), 'f5401dc')
  assert.equal(textOf(task, 'note'), 'looks good')
})

test('plan task with one bad flag among several writes none of them', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['task', '2', '--status', 'bogus', '--commit', 'f5401dc', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /bogus/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

// `reviewing` was a legal task status before the serial task loop retired it; a plan still naming
// it must be rejected the same as any other off-vocabulary value, not silently accepted.
test('plan task refuses the retired reviewing status and lists the four legal values, writing nothing', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['task', '2', '--status', 'reviewing', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /"reviewing" is not one of todo, doing, done, blocked/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('plan task fails on an id the plan does not have, and writes nothing', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const { code, err } = await run(cwd, ['task', '9', '--status', 'done', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /9/)
})

test('plan task fails when the id is claimed twice', async () => {
  const cwd = project({ dup: 'duplicate-keys.yaml' })
  const { code, err } = await run(cwd, ['task', '2', '--status', 'done', '--plan', 'dup'])
  assert.equal(code, 1)
  assert.match(err, /id 2/)
})

test('plan task fails when the field it targets is not in the object', async () => {
  // task 1 in missing-keys.yaml has neither commit nor note.
  const cwd = project({ mk: 'missing-keys.yaml' })
  const { code, err } = await run(cwd, ['task', '1', '--commit', 'abc1234', '--plan', 'mk'])
  assert.equal(code, 1)
  assert.match(err, /not found/)
})

test('plan task succeeds even though the file has unrelated improvised keys elsewhere', async () => {
  const cwd = project({ extra: 'extra-keys.yaml' })
  const { code } = await run(cwd, ['task', '1', '--status', 'done', '--plan', 'extra'])
  assert.equal(code, 0)
})

test('plan task needs at least one of --status, --commit or --note', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const { code, err } = await run(cwd, ['task', '1', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /--status/)
})

test('plan task refuses a flag for a frozen field', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['task', '1', '--goal', 'new goal', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /--goal/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('plan review writes review.status', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const { code, err } = await run(cwd, ['review', '--status', 'passed', '--plan', 'live'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const review = entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'review').value
  assert.equal(entryOf(review, 'status').value.text, 'passed')
})

test('plan review refuses an off-vocabulary status', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const { code, err } = await run(cwd, ['review', '--status', 'dong', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /dong/)
})

test('plan review fails when the plan has no review section', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.dev-kit', 'plans', 'bare.yaml'), 'status: running\ntasks: []\n')
  const { code, err } = await run(cwd, ['review', '--status', 'passed', '--plan', 'bare'])
  assert.equal(code, 1)
  assert.match(err, /review.*not found/)
})

// "not found" sends the reader looking for a key that is right there. What is wrong is its shape,
// and the line it is on is the only thing that leads to the fix.
test('plan review and verification report a key that is a value, not a missing one', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.dev-kit', 'plans', 'flat.yaml'), [
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
    '',
    'review: pending',
    'verification: pending',
    '',
  ].join('\n'))
  const review = await run(cwd, ['review', '--status', 'passed', '--plan', 'flat'])
  assert.equal(review.code, 1)
  assert.doesNotMatch(review.err, /not found/)
  assert.match(review.err, /^devkit: flat\.yaml:7: review: /)
  const verification = await run(cwd, ['verification', '--status', 'running', '--plan', 'flat'])
  assert.equal(verification.code, 1)
  assert.doesNotMatch(verification.err, /not found/)
  assert.match(verification.err, /^devkit: flat\.yaml:8: verification: /)
})

test('plan verification writes status, report, head and note together', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const { code, err } = await run(cwd, [
    'verification', '--status', 'reported', '--report', 'e2e/scratch/report.md', '--head', 'f5401dc',
    '--note', 'ran clean', '--plan', 'live',
  ])
  assert.equal(err, '')
  assert.equal(code, 0)
  const verification = entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'verification').value
  assert.equal(entryOf(verification, 'status').value.text, 'reported')
  assert.equal(entryOf(verification, 'report').value.text, 'e2e/scratch/report.md')
  assert.equal(entryOf(verification, 'head').value.text, 'f5401dc')
  assert.equal(entryOf(verification, 'note').value.text, 'ran clean')
})

test('plan verification refuses an off-vocabulary status and writes nothing', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['verification', '--status', 'dong', '--head', 'f5401dc', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /dong/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('plan context --add appends one entry, leaving the rest of the file untouched', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['context', '--add', 'A second verified fact', '--plan', 'live'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const after = fs.readFileSync(file, 'utf8')
  assertOnlySpanChanged(before, after, 12, 0, '  - A second verified fact')
  const context = entryOf(parsePlan(after).root, 'context').value
  assert.deepEqual(context.items.map(i => i.text), ['A verified fact at src/a.js:12', 'A second verified fact'])
})

test('plan context needs --add', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const { code, err } = await run(cwd, ['context', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /--add/)
})

// The second run reads the file the first one wrote: its list is now one item longer, and the new
// address is below that item, not on it.
test('two appends in a row leave both entries, the second after the first', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  assert.equal((await run(cwd, ['context', '--add', 'first added', '--plan', 'live'])).code, 0)
  assert.equal((await run(cwd, ['context', '--add', 'second added', '--plan', 'live'])).code, 0)
  const context = entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'context').value
  assert.deepEqual(context.items.map(i => i.text), ['A verified fact at src/a.js:12', 'first added', 'second added'])
})

test('plan review --fix converts the inline empty fixes: [] into block form', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const { code, err } = await run(cwd, ['review', '--fix', 'abc1234', '--plan', 'live'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const review = entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'review').value
  assert.deepEqual(entryOf(review, 'fixes').value.items.map(i => i.text), ['abc1234'])
})

test('plan review --status and --fix together write both, or neither', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const { code, err } = await run(cwd, ['review', '--status', 'passed', '--fix', 'abc1234', '--plan', 'live'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const review = entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'review').value
  assert.equal(entryOf(review, 'status').value.text, 'passed')
  assert.deepEqual(entryOf(review, 'fixes').value.items.map(i => i.text), ['abc1234'])
})

// Both edits address the same line here: the insertion goes in front of `status:`, the replacement
// rewrites it. Getting that pair backwards writes `status:` twice and drops the fix.
test('plan review --status and --fix land together when the fixes list ends right above status', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'above.yaml')
  fs.writeFileSync(file, ['status: running', 'tasks:', '  - id: 1', '    status: todo', '    deps: []', '', 'review:', '  fixes:', '    - abc1234', '  status: pending', ''].join('\n'))
  const { code, err } = await run(cwd, ['review', '--status', 'passed', '--fix', 'def5678', '--plan', 'above'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const review = entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'review').value
  assert.deepEqual(entryOf(review, 'fixes').value.items.map(i => i.text), ['abc1234', 'def5678'])
  assert.equal(entryOf(review, 'status').value.text, 'passed')
})

test('appending to a template-shaped plan keeps the legend on the [] line it converts', async () => {
  const before = fs.readFileSync(path.join(FIXTURES, 'commented.yaml'), 'utf8')
  const cwd = project({ tpl: 'commented.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'tpl.yaml')
  const { code, err } = await run(cwd, ['review', '--fix', 'abc1234', '--plan', 'tpl'])
  assert.equal(err, '')
  assert.equal(code, 0)
  const beforeLines = before.split('\n')
  const afterLines = fs.readFileSync(file, 'utf8').split('\n')
  const legend = beforeLines[22].slice('  fixes: []'.length)
  assert.notEqual(legend.trim(), '', 'the fixture must carry the template legend this test is about')
  assert.deepEqual(afterLines.slice(0, 22), beforeLines.slice(0, 22))
  assert.equal(afterLines[22], `  fixes:${legend}`)
  assert.equal(afterLines[23], '    - abc1234')
  assert.deepEqual(afterLines.slice(24), beforeLines.slice(23))
})

// Shared by the two tests below: a plan whose review.fixes is already at the two-fixer cap.
function projectWithTwoFixes() {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'twofixes.yaml')
  fs.writeFileSync(file, [
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: done',
    '    deps: []',
    '',
    'review:',
    '  status: pending',
    '  fixes:',
    '    - abc1234',
    '    - def5678',
    '',
    'verification:',
    '  status: pending',
    '',
  ].join('\n'))
  return { cwd, file }
}

test('plan review --fix fails once two fixes already exist, and writes nothing', async () => {
  const { cwd, file } = projectWithTwoFixes()
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['review', '--fix', 'deadbee', '--plan', 'twofixes'])
  assert.equal(code, 1)
  assert.match(err, /fixes/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

test('a --status and --fix combined where --fix is over the limit writes neither', async () => {
  const { cwd, file } = projectWithTwoFixes()
  const before = fs.readFileSync(file, 'utf8')
  const { code } = await run(cwd, ['review', '--status', 'passed', '--fix', 'deadbee', '--plan', 'twofixes'])
  assert.equal(code, 1)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

// `evidence` wrote parallel_evidence entries for the four-boundary gate; task-level parallelism is
// retired entirely, so the subcommand is gone rather than emptied, same as any other typo.
test('plan evidence is no longer a subcommand, and writes nothing', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  const before = fs.readFileSync(file, 'utf8')
  const { code, err } = await run(cwd, ['evidence', '--tasks', '2, 3', '--plan', 'live'])
  assert.equal(code, 1)
  assert.match(err, /"evidence" is not one/)
  assert.match(err, /usage: devkit plan/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

// parallel_evidence is off the plan schema now, so a plan still carrying one is graded the same as
// any other improvised top-level key: a note, not an error, and check does not descend into it.
test('plan check calls a leftover parallel_evidence an improvised key, not a schema field', () => {
  const doc = parsePlan([
    'status: running',
    'tasks:',
    '  - id: 1',
    '    status: todo',
    '    deps: []',
    '',
    'parallel_evidence:',
    '  - tasks: [1]',
    '    head: aaa1111',
    '    dependencies: bogus-not-a-real-key',
  ].join('\n'))
  const { errors, notes } = checkPlan(doc)
  assert.deepEqual(errors, [])
  assert.deepEqual(lines(notes), [7])
  assert.match(notes[0].message, /parallel_evidence/)
})

test('bin/devkit plan context appends through the real CLI', () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  execFileSync(process.execPath, [BIN, 'plan', 'context', '--add', 'via the real CLI', '--plan', 'live'], { cwd, encoding: 'utf8' })
  const context = entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'context').value
  assert.deepEqual(context.items.map(i => i.text), ['A verified fact at src/a.js:12', 'via the real CLI'])
})

// --- the wiring in bin/devkit, for a write command ----------------------------------------------

test('bin/devkit plan set writes through the real CLI', () => {
  const cwd = project({ live: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'live.yaml')
  execFileSync(process.execPath, [BIN, 'plan', 'set', 'status', 'done', '--plan', 'live'], { cwd, encoding: 'utf8' })
  assert.equal(entryOf(parsePlan(fs.readFileSync(file, 'utf8')).root, 'status').value.text, 'done')
})

// --- commands ----------------------------------------------------------------------------------

test('plan next prints the id and goal of every ready task', async () => {
  const cwd = project({ 'only-plan': 'conforming.yaml' })
  const { code, out, err } = await run(cwd, ['next'])
  assert.equal(err, '')
  assert.equal(code, 0)
  assert.equal(out, '2  Second slice')
})

// One line per ready task is what makes this output readable line by line. A folded goal with a
// paragraph break in it reads back with a newline, and printed raw it turns one task into several.
test('plan next keeps one line per task when a goal folds across paragraphs', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  fs.writeFileSync(path.join(cwd, '.dev-kit', 'plans', 'folded.yaml'), [
    'status: running',
    'tasks:',
    '  - id: 1',
    '    goal: >-',
    '      first paragraph',
    '',
    '      second paragraph',
    '    deps: []',
    '    status: todo',
    '',
  ].join('\n'))
  const { code, out } = await run(cwd, ['next'])
  assert.equal(code, 0)
  assert.deepEqual(out.split('\n'), ['1  first paragraph second paragraph'])
})

test('plan next prints nothing and succeeds when nothing is ready', async () => {
  const cwd = project({ '2026-08-01-dev-kit-evals': '2026-08-01-dev-kit-evals.yaml' })
  const { code, out } = await run(cwd, ['next'])
  assert.equal(code, 0)
  assert.equal(out, '')
})

test('plan next fails on a dangling dep', async () => {
  const cwd = project({ dangling: 'dangling-deps.yaml' })
  const { code, err } = await run(cwd, ['next'])
  assert.equal(code, 1)
  assert.match(err, /dangling\.yaml:22/)
})

test('plan next names no task ready on a deps it cannot read', async () => {
  const cwd = project({ 'off-shape': 'off-shape-tasks.yaml' })
  const { code, out, err } = await run(cwd, ['next'])
  assert.equal(code, 1)
  assert.equal(out, '')
  assert.match(err, /off-shape\.yaml:22/)
})

test('plan show prints the state summary', async () => {
  const cwd = project({ 'only-plan': 'conforming.yaml' })
  const { code, out } = await run(cwd, ['show'])
  assert.equal(code, 0)
  assert.equal(out, [
    'plan: only-plan',
    'status: running',
    'mode: subagent',
    'worktree: .dev-kit/worktrees/example',
    'review.status: pending',
    'verification.status: pending',
    'tasks:',
    '  1  done',
    '  2  todo',
    '  3  todo',
  ].join('\n'))
})

test('plan show --task prints every field of that task', async () => {
  const cwd = project({ 'only-plan': 'conforming.yaml' })
  const { code, out } = await run(cwd, ['show', '--task', '2'])
  assert.equal(code, 0)
  assert.match(out, /^id: 2$/m)
  assert.match(out, /^goal: Second slice$/m)
  assert.match(out, /^deps: \[1\]$/m)
  assert.match(out, /^files: \[src\/b\.js, dev-kit\/tests\/b\.test\.js\]$/m)
  assert.match(out, /^status: todo$/m)
  assert.match(out, /^commit: null$/m)
})

test('plan show --task fails on an id the plan does not have', async () => {
  const cwd = project({ 'only-plan': 'conforming.yaml' })
  const { code, err } = await run(cwd, ['show', '--task', '9'])
  assert.equal(code, 1)
  assert.match(err, /9/)
})

test('plan check exits non-zero on errors and prints them on stderr', async () => {
  // That plan is `status: done`, so this one names it rather than relying on the default.
  const cwd = project({ pi: '2026-07-31-pi-subagent-integration.yaml' })
  const { code, out, err } = await run(cwd, ['check', '--plan', 'pi'])
  assert.equal(code, 1)
  assert.match(err, /pi\.yaml:95/)
  assert.match(err, /pi\.yaml:99/)
  assert.match(out, /pi\.yaml:96/)
})

test('plan check exits zero when only improvised keys are left', async () => {
  const cwd = project({ extra: 'extra-keys.yaml' })
  const { code, out, err } = await run(cwd, ['check'])
  assert.equal(err, '')
  assert.equal(code, 0)
  assert.match(out, /extra\.yaml:21/)
  assert.match(out, /extra\.yaml:27/)
})

// A note that pastes a tab-indented command is legal YAML, and no plan subcommand repairs a plan,
// so refusing it would leave the file readable by hand only.
test('a plan carrying a tab inside a block scalar is still readable and writable', async () => {
  const cwd = project(null)
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans'), { recursive: true })
  const file = path.join(cwd, '.dev-kit', 'plans', 'tabbed.yaml')
  fs.writeFileSync(file, [
    'status: running',
    'tasks:',
    '  - id: 1',
    '    goal: Only slice',
    '    deps: []',
    '    status: todo',
    '    note: |-',
    '      the harness prints:',
    '      \tok 1 - passes',
    '',
  ].join('\n'))
  assert.deepEqual(await run(cwd, ['next']), { code: 0, out: '1  Only slice', err: '' })
  assert.equal((await run(cwd, ['show'])).code, 0)
  assert.equal((await run(cwd, ['check'])).code, 0)
  assert.equal((await run(cwd, ['task', '1', '--status', 'doing'])).code, 0)
  assert.match(fs.readFileSync(file, 'utf8'), /\n {6}\tok 1 - passes$/m)
})

// --- picking the plan ---------------------------------------------------------------------------

test('--plan may be omitted when exactly one plan is not done', async () => {
  const cwd = project({ live: 'conforming.yaml', shipped: '2026-07-31-pi-subagent-integration.yaml' })
  const { code, out } = await run(cwd, ['show'])
  assert.equal(code, 0)
  assert.match(out, /^plan: live$/m)
})

test('two unfinished plans is an ambiguity, and it lists them', async () => {
  const cwd = project({ live: 'conforming.yaml', 'also-live': 'extra-keys.yaml' })
  const { code, err } = await run(cwd, ['show'])
  assert.equal(code, 1)
  assert.match(err, /also-live/)
  assert.match(err, /live/)
  assert.match(err, /--plan/)
})

test('no unfinished plan fails and still lists the candidates', async () => {
  const cwd = project({ shipped: '2026-07-31-pi-subagent-integration.yaml' })
  const { code, err } = await run(cwd, ['next'])
  assert.equal(code, 1)
  assert.match(err, /shipped/)
})

test('--plan takes the slug, with or without the extension', async () => {
  const cwd = project({ live: 'conforming.yaml', 'also-live': 'extra-keys.yaml' })
  assert.equal((await run(cwd, ['show', '--plan', 'live'])).code, 0)
  assert.equal((await run(cwd, ['show', '--plan', 'live.yaml'])).code, 0)
})

test('a directory whose name ends in .yaml is not a plan', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  fs.mkdirSync(path.join(cwd, '.dev-kit', 'plans', 'adir.yaml'))
  const listed = await run(cwd, ['show'])
  assert.equal(listed.code, 0)
  assert.match(listed.out, /^plan: live$/m)
  const named = await run(cwd, ['show', '--plan', 'adir'])
  assert.equal(named.code, 1)
  assert.match(named.err, /adir/)
})

// Three things this CLI is supposed to tell apart: no project, no plans directory, no such plan. A
// plan that is there but cannot be opened is a fourth, and answering it with the third sends the
// reader looking for a file that exists.
test('a plan file that cannot be read says so, instead of reporting the plan as absent', async () => {
  const cwd = project({ live: 'conforming.yaml', locked: 'conforming.yaml' })
  const file = path.join(cwd, '.dev-kit', 'plans', 'locked.yaml')
  fs.chmodSync(file, 0o000)
  try {
    const { code, err } = await run(cwd, ['show', '--plan', 'locked'])
    assert.equal(code, 1)
    // The file it could not read, named. The message that names the directory instead is the one
    // every other plan in that directory would fail with too, which is a different fault.
    assert.match(err, /^devkit: could not read locked\.yaml: /)
    assert.doesNotMatch(err, /no plan/)
  } finally {
    fs.chmodSync(file, 0o600)
  }
})

// Enumerating the directory is how `--plan` is resolved, so a sibling that cannot be opened is met
// on the way to every plan. Reading its status is worth exactly one plan's answer, never the run.
test('one unreadable plan does not stop a command that named a readable one', async () => {
  const cwd = project({ live: 'conforming.yaml', locked: 'conforming.yaml' })
  const locked = path.join(cwd, '.dev-kit', 'plans', 'locked.yaml')
  fs.chmodSync(locked, 0o000)
  try {
    const { code, out, err } = await run(cwd, ['show', '--plan', 'live'])
    assert.equal(err, '')
    assert.equal(code, 0)
    assert.match(out, /^plan: live$/m)
    // And it is still a candidate: with no --plan, an unknown status counts as not done, so the
    // two of them are an ambiguity rather than a silent pick.
    const ambiguous = await run(cwd, ['show'])
    assert.equal(ambiguous.code, 1)
    assert.match(ambiguous.err, /locked/)
  } finally {
    fs.chmodSync(locked, 0o600)
  }
})

test('a slug that is not there fails saying so', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  const { code, err } = await run(cwd, ['show', '--plan', 'nope'])
  assert.equal(code, 1)
  assert.match(err, /nope/)
})

test('a slug reaching outside the plan directory is refused', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  fs.writeFileSync(path.join(cwd, 'outside.yaml'), 'status: running\ntasks: []\n')
  for (const slug of ['../outside', '../../etc/passwd', 'live/../../outside']) {
    const { code, out } = await run(cwd, ['show', '--plan', slug])
    assert.equal(code, 1, slug)
    assert.equal(out, '', slug)
  }
})

test('a project with no plan directory, and no project at all, each say which', async () => {
  const empty = project(null)
  const noDir = await run(empty, ['next'])
  assert.equal(noDir.code, 1)
  assert.match(noDir.err, /\.dev-kit\/plans/)

  const nowhere = await run(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-noproject-'))), ['next'])
  assert.equal(nowhere.code, 1)
  assert.match(nowhere.err, /project root/)
})

// parseArgs accepts every subcommand in SUBS, and the dispatch below it is a chain of ifs. One
// added to the table and to no branch falls out of that chain returning undefined, which bin/devkit
// assigns to process.exitCode: a command that did nothing at all exits like one that worked.
test('a subcommand the dispatch has no branch for fails instead of exiting zero', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  SUBS.archive = { flags: ['--plan'] }
  try {
    const { code, err } = await run(cwd, ['archive', '--plan', 'live'])
    assert.equal(code, 1)
    assert.match(err, /archive/)
  } finally {
    delete SUBS.archive
  }
})

test('an unknown subcommand or flag fails rather than being ignored', async () => {
  const cwd = project({ live: 'conforming.yaml' })
  assert.equal((await run(cwd, [])).code, 1)
  assert.equal((await run(cwd, ['bogus'])).code, 1)
  assert.equal((await run(cwd, ['next', '--task', '1'])).code, 1)
  assert.equal((await run(cwd, ['show', '--nope'])).code, 1)
  assert.equal((await run(cwd, ['show', '--plan'])).code, 1)
})

// --- the wiring in bin/devkit --------------------------------------------------------------------

test('bin/devkit plan carries the exit code of an async command', () => {
  const cwd = project({ pi: '2026-07-31-pi-subagent-integration.yaml', live: 'conforming.yaml' })
  const devkit = (args, opts) => execFileSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', ...opts })

  assert.equal(devkit(['plan', 'next', '--plan', 'live']).trim(), '2  Second slice')
  assert.throws(() => devkit(['plan', 'check', '--plan', 'pi'], { stdio: 'pipe' }), e => e.status === 1)
  assert.match(devkit(['help']), /devkit plan/)
})

test('devkit help names every plan subcommand the CLI accepts, and no others', async () => {
  // SUBS is what cmdPlan dispatches on, so it is the accepted set; the usage line and bin/devkit's
  // HELP are two hand-written copies of it. Checking them against each other would pass a
  // subcommand added to SUBS and written into neither, which is the drift that matters.
  const subs = Object.keys(SUBS).sort()
  assert.ok(subs.length > 3, subs)

  let usage = ''
  await cmdPlan([], { err: s => { usage += s } })
  assert.deepEqual(/devkit plan <([a-z|]+)>/.exec(usage)[1].split('|').sort(), subs)

  const help = execFileSync(process.execPath, [BIN, 'help'], { encoding: 'utf8' })
  assert.deepEqual([...help.matchAll(/^ +devkit plan ([a-z]+)/gm)].map(m => m[1]).sort(), subs)
})

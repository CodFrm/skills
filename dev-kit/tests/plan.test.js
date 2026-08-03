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
  VOCAB, PlanError, parsePlan, entryOf, taskNodes, readyTasks, checkPlan, cmdPlan,
} = require('../lib/plan')

const FIXTURES = path.join(__dirname, 'fixtures', 'plans')
const BIN = path.join(__dirname, '..', 'bin', 'devkit')

const load = name => parsePlan(fs.readFileSync(path.join(FIXTURES, name), 'utf8'), name)

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

// --- commands ----------------------------------------------------------------------------------

test('plan next prints the id and goal of every ready task', async () => {
  const cwd = project({ 'only-plan': 'conforming.yaml' })
  const { code, out, err } = await run(cwd, ['next'])
  assert.equal(err, '')
  assert.equal(code, 0)
  assert.equal(out, '2  Second slice')
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
  assert.match(out, /extra\.yaml:23/)
  assert.match(out, /extra\.yaml:29/)
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

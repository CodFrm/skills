'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const EXTENSION = path.join(__dirname, '..', '.pi', 'extensions', 'subagent', 'subagent.ts')
const FAKE_PI = path.join(__dirname, 'fixtures', 'fake-pi.js')
const BUILTIN_TOOLS = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls', 'subagent']

async function loadTool() {
  let tool
  const pi = {
    registerTool(definition) {
      assert.equal(tool, undefined)
      tool = definition
    },
    getAllTools() {
      return BUILTIN_TOOLS.map(name => ({ name }))
    },
  }
  const mod = await import(`${pathToFileURL(EXTENSION).href}?test=${Date.now()}-${Math.random()}`)
  mod.default(pi)
  return tool
}

function useFakePi(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const previous = {
    argv1: process.argv[1],
    capture: process.env.FAKE_PI_CAPTURE,
    timeline: process.env.FAKE_PI_TIMELINE,
  }
  const capturePath = path.join(root, 'capture.jsonl')
  const timelinePath = path.join(root, 'timeline.jsonl')
  process.argv[1] = FAKE_PI
  process.env.FAKE_PI_CAPTURE = capturePath
  process.env.FAKE_PI_TIMELINE = timelinePath
  t.after(() => {
    process.argv[1] = previous.argv1
    for (const [key, value] of [
      ['FAKE_PI_CAPTURE', previous.capture],
      ['FAKE_PI_TIMELINE', previous.timeline],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    fs.rmSync(root, { recursive: true, force: true })
  })
  return { root, capturePath, timelinePath }
}

function context(cwd) {
  return {
    cwd,
    model: { provider: 'parent-provider', id: 'parent-model' },
    thinkingLevel: 'medium',
    isProjectTrusted: () => true,
  }
}

function finalOutput(result) {
  for (let index = result.messages.length - 1; index >= 0; index -= 1) {
    const message = result.messages[index]
    if (message.role !== 'assistant') continue
    const text = message.content.find(part => part.type === 'text')
    if (text) return text.text
  }
  return ''
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return []
  const content = fs.readFileSync(file, 'utf8').trim()
  return content ? content.split('\n').map(JSON.parse) : []
}

function maxConcurrent(events) {
  let active = 0
  let maximum = 0
  for (const event of [...events].sort((a, b) => a.time - b.time || (a.event === 'start' ? 1 : -1))) {
    if (event.event === 'start') {
      active += 1
      maximum = Math.max(maximum, active)
    } else {
      active -= 1
    }
  }
  return maximum
}

test('parallel keeps input order and partial failures while running at most four children', async t => {
  const { root, timelinePath } = useFakePi(t, 'dev-kit-subagent-parallel-')
  const tool = await loadTool()
  const updates = []
  const tasks = Array.from({ length: 6 }, (_, index) => ({
    task: `[delay=120] [output=task-${index}]${index === 2 ? ' [fail]' : ''}`,
    profile: 'write',
  }))

  const result = await tool.execute('parallel', { tasks }, undefined, update => updates.push(update), context(root))

  assert.equal(result.isError, undefined)
  assert.match(result.content[0].text, /Parallel: 5\/6 succeeded/)
  assert.equal(result.details.mode, 'parallel')
  assert.equal(result.details.results.length, 6)
  assert.deepEqual(result.details.results.map(finalOutput), tasks.map((_, index) => `task-${index}`))
  assert.equal(result.details.results[2].exitCode, 2)
  assert.equal(result.details.results[2].stopReason, 'error')
  assert.match(result.content[0].text, /marked fake failure/)
  assert.ok(updates.some(update => update.details?.mode === 'parallel'))

  const timeline = readJsonLines(timelinePath)
  assert.equal(maxConcurrent(timeline), 4)
})

test('parallel limits and mode conflicts reject the whole request before spawning', async t => {
  const { root, capturePath } = useFakePi(t, 'dev-kit-subagent-preflight-')
  const tool = await loadTool()
  const nine = Array.from({ length: 9 }, (_, index) => ({ task: `task ${index}`, profile: 'write' }))
  const cases = [
    [{ tasks: nine }, /tasks.*at most 8/i],
    [{ task: 'single', profile: 'write', tasks: [{ task: 'parallel', profile: 'write' }] }, /exactly one mode/i],
    [{ tasks: [{ task: 'valid', profile: 'write' }, { task: 'invalid', profile: 'read-only', tools: ['write'] }] }, /tasks\[1\].*write/i],
  ]

  for (const [params, expected] of cases) {
    const result = await tool.execute('invalid-mode', params, undefined, undefined, context(root))
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, expected)
    assert.equal(result.details.results.length, 0)
  }
  assert.equal(fs.existsSync(capturePath), false)
})

test('chain substitutes successful output and stops at the first failed step', async t => {
  const { root, capturePath } = useFakePi(t, 'dev-kit-subagent-chain-')
  const tool = await loadTool()
  const result = await tool.execute(
    'chain',
    {
      chain: [
        { task: 'first [output=alpha]', profile: 'read-only' },
        { task: 'second received={previous} [output=beta]', profile: 'read-only' },
        { task: 'third received={previous} [output=gamma] [fail]', profile: 'write' },
        { task: 'must not run [output=delta]', profile: 'write' },
      ],
    },
    undefined,
    undefined,
    context(root),
  )

  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /Chain stopped at step 3/i)
  assert.equal(result.details.mode, 'chain')
  assert.equal(result.details.results.length, 3)
  assert.deepEqual(result.details.results.map(finalOutput), ['alpha', 'beta', 'gamma'])
  assert.deepEqual(result.details.results.map(item => item.step), [1, 2, 3])

  const captures = readJsonLines(capturePath)
  assert.equal(captures.length, 3)
  assert.match(captures[1].args.at(-1), /received=alpha/)
  assert.match(captures[2].args.at(-1), /received=beta/)
  assert.doesNotMatch(captures.map(item => item.args.at(-1)).join('\n'), /must not run/)
})

test('aborting parallel work preserves completed results and marks every unfinished task aborted', async t => {
  const { root, capturePath } = useFakePi(t, 'dev-kit-subagent-abort-')
  const tool = await loadTool()
  const controller = new AbortController()
  const tasks = [
    { task: '[delay=20] [output=quick]', profile: 'read-only' },
    ...Array.from({ length: 5 }, (_, index) => ({
      task: `[delay=3000] [output=slow-${index}]`,
      profile: 'read-only',
    })),
  ]

  const started = Date.now()
  const execution = tool.execute('abort', { tasks }, controller.signal, undefined, context(root))
  setTimeout(() => controller.abort(), 250)
  const result = await execution
  const elapsed = Date.now() - started

  assert.ok(elapsed < 1500, `abort took ${elapsed}ms`)
  assert.equal(result.details.results.length, 6)
  assert.equal(finalOutput(result.details.results[0]), 'quick')
  assert.equal(result.details.results[0].stopReason, 'end')
  assert.deepEqual(result.details.results.slice(1).map(item => item.stopReason), Array(5).fill('aborted'))
  assert.match(result.content[0].text, /1\/6 succeeded/)
  assert.match(result.content[0].text, /aborted/i)

  const captures = readJsonLines(capturePath)
  assert.ok(captures.length < tasks.length, 'queued tasks were spawned after abort')
})

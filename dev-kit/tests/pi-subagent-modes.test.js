'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const EXTENSION = path.join(__dirname, '..', '.pi', 'extensions', 'subagent', 'subagent.ts')
const FAKE_PI = path.join(__dirname, 'fixtures', 'fake-pi.js')
const ACTIVE_TOOLS = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls', 'subagent']

async function loadTool() {
  let tool
  const pi = {
    registerTool(definition) {
      assert.equal(tool, undefined)
      tool = definition
    },
    getActiveTools() {
      return [...ACTIVE_TOOLS]
    },
    getAllTools() {
      return ACTIVE_TOOLS.map(name => ({ name }))
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

function readJsonLines(file) {
  if (!fs.existsSync(file)) return []
  const content = fs.readFileSync(file, 'utf8').trim()
  return content ? content.split('\n').map(JSON.parse) : []
}

async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`condition not met within ${timeoutMs}ms`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function maxConcurrent(events) {
  let active = 0
  let maximum = 0
  for (const event of [...events].sort((a, b) => a.time - b.time)) {
    if (event.event === 'start') {
      active += 1
      maximum = Math.max(maximum, active)
    } else if (event.event === 'end' || event.event === 'aborted' || event.event === 'signaled') {
      active -= 1
    }
  }
  return maximum
}

test('two independent calls overlap and keep their results isolated', async t => {
  const { root, capturePath, timelinePath } = useFakePi(t, 'dev-kit-subagent-reentrant-')
  const tool = await loadTool()

  const [first, second] = await Promise.all([
    tool.execute(
      'first',
      { task: '[delay=180] [output=alpha]', profile: 'write' },
      undefined,
      undefined,
      context(root),
    ),
    tool.execute(
      'second',
      { task: '[delay=180] [output=beta] [fail]', profile: 'read-only' },
      undefined,
      undefined,
      context(root),
    ),
  ])

  assert.equal(first.isError, undefined)
  assert.equal(first.content[0].text, 'alpha')
  assert.equal(first.details.results[0].task, '[delay=180] [output=alpha]')
  assert.equal(second.isError, true)
  assert.match(second.content[0].text, /marked fake failure/)
  assert.equal(second.details.results[0].task, '[delay=180] [output=beta] [fail]')
  assert.equal(second.details.results[0].messages.at(-1).content[0].text, 'beta')

  const captures = readJsonLines(capturePath)
  assert.equal(captures.length, 2)
  assert.deepEqual(new Set(captures.map(item => item.args.at(-1))), new Set([
    'Task: [delay=180] [output=alpha]',
    'Task: [delay=180] [output=beta] [fail]',
  ]))
  assert.equal(maxConcurrent(readJsonLines(timelinePath)), 2)
})

test('aborting a call terminates its child and returns failure evidence', async t => {
  const { root, capturePath } = useFakePi(t, 'dev-kit-subagent-abort-')
  const tool = await loadTool()
  const controller = new AbortController()
  const started = Date.now()
  const execution = tool.execute(
    'abort',
    { task: '[delay=3000] [output=too-late]', profile: 'read-only' },
    controller.signal,
    undefined,
    context(root),
  )
  await waitFor(() => readJsonLines(capturePath).length === 1)
  controller.abort()

  const result = await execution
  const elapsed = Date.now() - started

  assert.ok(elapsed < 1500, `abort took ${elapsed}ms`)
  assert.equal(result.isError, true)
  assert.equal(result.details.results[0].stopReason, 'aborted')
  assert.equal(result.details.results[0].errorMessage, 'Subagent was aborted')
  assert.ok(result.details.results[0].exitCode > 0)
  assert.match(result.content[0].text, /aborted/i)
  assert.equal(readJsonLines(capturePath).length, 1)
})

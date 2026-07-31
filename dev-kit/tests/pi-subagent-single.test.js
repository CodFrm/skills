'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const DEV_KIT_ROOT = path.join(__dirname, '..')
const BASE_MANIFEST = path.join(DEV_KIT_ROOT, 'package.json')
const PACKAGE_ROOT = path.join(DEV_KIT_ROOT, '.pi', 'extensions', 'subagent')
const PACKAGE_MANIFEST = path.join(PACKAGE_ROOT, 'package.json')
const EXTENSION = path.join(PACKAGE_ROOT, 'subagent.ts')
const FAKE_PI = path.join(__dirname, 'fixtures', 'fake-pi.js')

async function loadTool(toolNames = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls', 'subagent']) {
  let tool
  const pi = {
    registerTool(definition) {
      assert.equal(tool, undefined, 'extension registered more than one tool')
      tool = definition
    },
    getAllTools() {
      return toolNames.map(name => ({ name }))
    },
  }
  const url = `${pathToFileURL(EXTENSION).href}?test=${Date.now()}-${Math.random()}`
  const mod = await import(url)
  mod.default(pi)
  return tool
}

test('optional package registers subagent without widening the base dev-kit package', async () => {
  assert.equal(fs.existsSync(PACKAGE_MANIFEST), true, 'missing optional package manifest')
  assert.equal(fs.existsSync(EXTENSION), true, 'missing manifest-declared extension')

  const optionalPackage = JSON.parse(fs.readFileSync(PACKAGE_MANIFEST, 'utf8'))
  const basePackage = JSON.parse(fs.readFileSync(BASE_MANIFEST, 'utf8'))

  assert.equal(optionalPackage.name, 'dev-kit-pi-subagent')
  assert.deepEqual(optionalPackage.pi.extensions, ['./subagent.ts'])
  assert.equal(optionalPackage.peerDependencies['@earendil-works/pi-agent-core'], '*')
  assert.equal(optionalPackage.peerDependencies['@earendil-works/pi-ai'], '*')
  assert.equal(optionalPackage.peerDependencies['@earendil-works/pi-coding-agent'], '*')
  assert.equal(optionalPackage.peerDependencies['@earendil-works/pi-tui'], '*')
  assert.equal(optionalPackage.peerDependencies.typebox, '*')
  assert.deepEqual(basePackage.pi.extensions, ['./.pi/extensions/dev-kit.ts'])

  const tool = await loadTool()
  assert.equal(tool.name, 'subagent')
  assert.equal(tool.label, 'Subagent')
  assert.equal(typeof tool.execute, 'function')
  assert.equal(tool.parameters.type, 'object')
})

test('single write task launches an isolated Pi process with explicit runtime choices', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-kit-subagent-test-'))
  const childCwd = path.join(root, 'child')
  const capturePath = path.join(root, 'capture.jsonl')
  fs.mkdirSync(childCwd)

  const previousArgv1 = process.argv[1]
  const previousCapture = process.env.FAKE_PI_CAPTURE
  process.argv[1] = FAKE_PI
  process.env.FAKE_PI_CAPTURE = capturePath
  t.after(() => {
    process.argv[1] = previousArgv1
    if (previousCapture === undefined) delete process.env.FAKE_PI_CAPTURE
    else process.env.FAKE_PI_CAPTURE = previousCapture
    fs.rmSync(root, { recursive: true, force: true })
  })

  const tool = await loadTool(['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls', 'artifact', 'subagent'])
  const updates = []
  const result = await tool.execute(
    'call-1',
    {
      task: 'Implement the approved slice',
      profile: 'write',
      model: 'local-llm/gpt-5.6-sol',
      thinking: 'high',
      tools: ['read', 'artifact'],
      cwd: 'child',
    },
    undefined,
    update => updates.push(update),
    {
      cwd: root,
      model: { provider: 'parent-provider', id: 'parent-model' },
      thinkingLevel: 'medium',
      isProjectTrusted: () => true,
    },
  )

  assert.equal(result.isError, undefined)
  assert.equal(result.content[0].text, 'fake subagent completed')
  assert.equal(result.details.mode, 'single')
  assert.equal(result.details.results.length, 1)
  assert.deepEqual(result.details.results[0].usage, {
    input: 11,
    output: 7,
    cacheRead: 3,
    cacheWrite: 2,
    cost: 0.0123,
    contextTokens: 23,
    turns: 1,
  })
  assert.equal(result.details.results[0].model, 'fake-provider/fake-model')
  assert.ok(updates.length > 0, 'JSONL progress was not streamed to onUpdate')

  const captures = fs.readFileSync(capturePath, 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(captures.length, 1)
  assert.equal(captures[0].cwd, fs.realpathSync(childCwd))
  assert.deepEqual(captures[0].args.slice(0, 4), ['--mode', 'json', '-p', '--no-session'])
  assert.deepEqual(captures[0].args.slice(captures[0].args.indexOf('--model'), captures[0].args.indexOf('--model') + 2), [
    '--model',
    'local-llm/gpt-5.6-sol',
  ])
  assert.deepEqual(captures[0].args.slice(captures[0].args.indexOf('--thinking'), captures[0].args.indexOf('--thinking') + 2), [
    '--thinking',
    'high',
  ])
  assert.deepEqual(captures[0].args.slice(captures[0].args.indexOf('--tools'), captures[0].args.indexOf('--tools') + 2), [
    '--tools',
    'read,artifact',
  ])
  assert.ok(captures[0].args.includes('--approve'))
  assert.equal(captures[0].args.at(-1), 'Task: Implement the approved slice')
  assert.match(captures[0].systemPrompt, /dispatched subagent/i)
  assert.match(captures[0].systemPrompt, /must not.*subagent/i)
})

test('read-only task inherits the parent model and thinking without extending project trust', async t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-kit-subagent-trust-'))
  const parentCwd = path.join(base, 'parent')
  const outsideCwd = path.join(base, 'outside')
  const capturePath = path.join(base, 'capture.jsonl')
  fs.mkdirSync(parentCwd)
  fs.mkdirSync(outsideCwd)

  const previousArgv1 = process.argv[1]
  const previousCapture = process.env.FAKE_PI_CAPTURE
  process.argv[1] = FAKE_PI
  process.env.FAKE_PI_CAPTURE = capturePath
  t.after(() => {
    process.argv[1] = previousArgv1
    if (previousCapture === undefined) delete process.env.FAKE_PI_CAPTURE
    else process.env.FAKE_PI_CAPTURE = previousCapture
    fs.rmSync(base, { recursive: true, force: true })
  })

  const tool = await loadTool()
  const result = await tool.execute(
    'call-2',
    { task: 'Review the branch', profile: 'read-only', cwd: '../outside' },
    undefined,
    undefined,
    {
      cwd: parentCwd,
      model: { provider: 'parent-provider', id: 'parent-model' },
      thinkingLevel: 'medium',
      isProjectTrusted: () => true,
    },
  )

  assert.equal(result.isError, undefined)
  const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8').trim())
  assert.deepEqual(capture.args.slice(capture.args.indexOf('--model'), capture.args.indexOf('--model') + 2), [
    '--model',
    'parent-provider/parent-model',
  ])
  assert.deepEqual(capture.args.slice(capture.args.indexOf('--thinking'), capture.args.indexOf('--thinking') + 2), [
    '--thinking',
    'medium',
  ])
  assert.deepEqual(capture.args.slice(capture.args.indexOf('--tools'), capture.args.indexOf('--tools') + 2), [
    '--tools',
    'read,bash,grep,find,ls',
  ])
  assert.ok(capture.args.includes('--no-approve'))
  assert.equal(capture.cwd, fs.realpathSync(outsideCwd))
  assert.match(capture.systemPrompt, /must not produce side effects/i)
  assert.match(capture.systemPrompt, /git diff.*git show.*git log/is)
})

test('invalid single-task fields fail before a Pi process starts', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-kit-subagent-invalid-'))
  const capturePath = path.join(root, 'capture.jsonl')
  const previousArgv1 = process.argv[1]
  const previousCapture = process.env.FAKE_PI_CAPTURE
  process.argv[1] = FAKE_PI
  process.env.FAKE_PI_CAPTURE = capturePath
  t.after(() => {
    process.argv[1] = previousArgv1
    if (previousCapture === undefined) delete process.env.FAKE_PI_CAPTURE
    else process.env.FAKE_PI_CAPTURE = previousCapture
    fs.rmSync(root, { recursive: true, force: true })
  })

  const tool = await loadTool()
  const ctx = {
    cwd: root,
    model: { provider: 'parent-provider', id: 'parent-model' },
    thinkingLevel: 'medium',
    isProjectTrusted: () => true,
  }
  const cases = [
    [{ task: 'work', profile: 'admin' }, /profile/],
    [{ task: '   ', profile: 'write' }, /task/],
    [{ task: 'work', profile: 'write', cwd: 'missing' }, /cwd/],
    [{ task: 'work', profile: 'write', model: 'strong' }, /model/],
    [{ task: 'work', profile: 'write', thinking: 'extreme' }, /thinking/],
    [{ task: 'work', profile: 'write', tools: ['read', 'subagent'] }, /tools.*subagent/],
    [{ task: 'work', profile: 'write', tools: ['read', 'unknown'] }, /tools.*unknown/],
    [{ task: 'work', profile: 'read-only', tools: ['read', 'write'] }, /tools.*write/],
  ]

  for (const [params, expected] of cases) {
    const result = await tool.execute('invalid', params, undefined, undefined, ctx)
    assert.equal(result.isError, true, JSON.stringify(params))
    assert.match(result.content[0].text, expected, JSON.stringify(params))
    assert.deepEqual(result.details, { mode: 'single', results: [] })
  }
  assert.equal(fs.existsSync(capturePath), false, 'invalid input launched the fake Pi process')
})

test('single task failure returns exit, stop reason, error, stderr, and last output', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-kit-subagent-error-'))
  const previous = {
    argv1: process.argv[1],
    capture: process.env.FAKE_PI_CAPTURE,
    output: process.env.FAKE_PI_OUTPUT,
    stopReason: process.env.FAKE_PI_STOP_REASON,
    errorMessage: process.env.FAKE_PI_ERROR_MESSAGE,
    stderr: process.env.FAKE_PI_STDERR,
    exitCode: process.env.FAKE_PI_EXIT_CODE,
  }
  process.argv[1] = FAKE_PI
  process.env.FAKE_PI_CAPTURE = path.join(root, 'capture.jsonl')
  process.env.FAKE_PI_OUTPUT = 'last partial output'
  process.env.FAKE_PI_STOP_REASON = 'error'
  process.env.FAKE_PI_ERROR_MESSAGE = 'provider unavailable'
  process.env.FAKE_PI_STDERR = 'child diagnostic'
  process.env.FAKE_PI_EXIT_CODE = '2'
  t.after(() => {
    process.argv[1] = previous.argv1
    for (const [key, value] of [
      ['FAKE_PI_CAPTURE', previous.capture],
      ['FAKE_PI_OUTPUT', previous.output],
      ['FAKE_PI_STOP_REASON', previous.stopReason],
      ['FAKE_PI_ERROR_MESSAGE', previous.errorMessage],
      ['FAKE_PI_STDERR', previous.stderr],
      ['FAKE_PI_EXIT_CODE', previous.exitCode],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    fs.rmSync(root, { recursive: true, force: true })
  })

  const tool = await loadTool()
  const result = await tool.execute(
    'call-3',
    { task: 'Use the unavailable provider', profile: 'write' },
    undefined,
    undefined,
    {
      cwd: root,
      model: { provider: 'parent-provider', id: 'parent-model' },
      thinkingLevel: 'low',
      isProjectTrusted: () => false,
    },
  )

  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /exit code: 2/i)
  assert.match(result.content[0].text, /stop reason: error/i)
  assert.match(result.content[0].text, /provider unavailable/)
  assert.match(result.content[0].text, /child diagnostic/)
  assert.match(result.content[0].text, /last partial output/)
  assert.equal(result.details.results[0].exitCode, 2)
  assert.equal(result.details.results[0].stopReason, 'error')
  assert.equal(result.details.results[0].errorMessage, 'provider unavailable')
  assert.equal(result.details.results[0].stderr, 'child diagnostic')
})

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const EXTENSION = path.join(__dirname, '..', '.pi', 'extensions', 'subagent', 'subagent.ts')
const RENDER = path.join(__dirname, '..', '.pi', 'extensions', 'subagent', 'lib', 'render.ts')
const FAKE_PI = path.join(__dirname, 'fixtures', 'fake-pi.js')

async function loadTool() {
  let tool
  const pi = {
    registerTool(definition) {
      tool = definition
    },
    getAllTools() {
      return ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls', 'subagent'].map(name => ({ name }))
    },
  }
  const mod = await import(`${pathToFileURL(EXTENSION).href}?test=${Date.now()}-${Math.random()}`)
  mod.default(pi)
  return tool
}

test('subagent registers custom call and result renderers', async () => {
  const tool = await loadTool()
  assert.equal(typeof tool.renderCall, 'function')
  assert.equal(typeof tool.renderResult, 'function')
})

class FakeText {
  constructor(text = '') {
    this.text = text
  }
  render() {
    return this.text.split('\n')
  }
  invalidate() {}
}

class FakeContainer {
  constructor() {
    this.children = []
  }
  addChild(child) {
    this.children.push(child)
  }
  render(width) {
    return this.children.flatMap(child => child.render(width))
  }
  invalidate() {}
}

class FakeSpacer {
  render() {
    return ['']
  }
  invalidate() {}
}

class FakeMarkdown extends FakeText {}

const fakeRuntime = {
  Text: FakeText,
  Container: FakeContainer,
  Spacer: FakeSpacer,
  Markdown: FakeMarkdown,
}
const theme = {
  fg(_color, text) {
    return text
  },
  bold(text) {
    return text
  },
  italic(text) {
    return text
  },
  underline(text) {
    return text
  },
}

function render(component) {
  return component.render(120).join('\n')
}

function result(overrides = {}) {
  return {
    task: 'Inspect the branch',
    profile: 'read-only',
    cwd: '/tmp/project',
    exitCode: 0,
    messages: [
      {
        role: 'assistant',
        content: [
          { type: 'toolCall', name: 'read', arguments: { path: '/tmp/project/file.ts' } },
          { type: 'text', text: 'Final **answer**' },
        ],
        usage: {},
      },
    ],
    stderr: '',
    usage: { input: 1200, output: 20, cacheRead: 3, cacheWrite: 4, cost: 0.0123, contextTokens: 1500, turns: 2 },
    model: 'fake-provider/fake-model',
    stopReason: 'end',
    ...overrides,
  }
}

test('renderers show exactly one task call, progress, output, usage, and model', async () => {
  const { createRenderers } = await import(`${pathToFileURL(RENDER).href}?test=${Date.now()}-${Math.random()}`)
  const renderers = createRenderers(fakeRuntime)

  const call = render(renderers.renderCall(
    { task: 'Inspect the branch', profile: 'read-only' },
    theme,
    {},
  ))
  assert.match(call, /subagent.*read-only/i)
  assert.match(call, /Inspect the branch/)
  assert.doesNotMatch(call, /parallel|chain|batch|step|aggregate/i)

  for (const expanded of [false, true]) {
    const rendered = render(renderers.renderResult(
      { content: [{ type: 'text', text: 'Final answer' }], details: result() },
      { expanded, isPartial: false },
      theme,
      {},
    ))
    assert.match(rendered, /✓.*read-only/)
    assert.match(rendered, /Inspect the branch/)
    assert.match(rendered, /read .*file\.ts/)
    assert.match(rendered, /Final \*\*answer\*\*/)
    assert.match(rendered, /2 turns.*↑1\.2k.*↓20.*R3.*W4.*\$0\.0123.*ctx:1\.5k.*fake-provider\/fake-model/)
    assert.doesNotMatch(rendered, /parallel|chain|batch|step|aggregate|Total:/i)
  }

  const running = render(renderers.renderResult(
    {
      content: [{ type: 'text', text: '(running...)' }],
      details: result({ exitCode: -1, messages: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 } }),
    },
    { expanded: false, isPartial: true },
    theme,
    {},
  ))
  assert.match(running, /⏳.*read-only/)
  assert.match(running, /Inspect the branch/)
  assert.match(running, /\(running\.\.\.\)/)
  assert.match(running, /fake-provider\/fake-model/)
})

test('rendering shows text for unrecognized details', async () => {
  const { createRenderers } = await import(`${pathToFileURL(RENDER).href}?test=${Date.now()}-${Math.random()}`)
  const renderers = createRenderers(fakeRuntime)
  const output = {
    content: [{ type: 'text', text: 'Readable response' }],
    details: { unexpected: true },
  }

  const rendered = render(renderers.renderResult(
    output,
    { expanded: false, isPartial: false },
    theme,
    {},
  ))
  assert.match(rendered, /Readable response/)
})

test('compact progress is bounded while expanded rendering and direct task details stay complete', async () => {
  const { createRenderers } = await import(`${pathToFileURL(RENDER).href}?test=${Date.now()}-${Math.random()}`)
  const renderers = createRenderers(fakeRuntime)
  const longArgument = 'x'.repeat(16 * 1024)
  const history = Array.from({ length: 48 }, (_, index) => ({
    role: 'assistant',
    content: [{ type: 'text', text: `earlier output ${index}: ${'history '.repeat(80)}` }],
    usage: {},
  }))
  const messages = [
    ...history,
    { role: 'assistant', content: [{ type: 'toolCall', name: 'custom', arguments: { value: longArgument } }], usage: {} },
    { role: 'assistant', content: [{ type: 'text', text: 'latest output' }], usage: {} },
  ]
  const taskResult = result({ messages })
  const modelVisibleOutput = 'model-visible output remains complete'
  const toolResult = { content: [{ type: 'text', text: modelVisibleOutput }], details: taskResult }

  const compact = render(renderers.renderResult(
    toolResult,
    { expanded: false, isPartial: true },
    theme,
    {},
  ))
  assert.ok(Buffer.byteLength(compact, 'utf8') < 6 * 1024, `compact render was ${Buffer.byteLength(compact, 'utf8')} bytes`)
  assert.match(compact, /earlier items/)
  assert.match(compact, /latest output/)
  assert.doesNotMatch(compact, new RegExp(longArgument))

  const expanded = render(renderers.renderResult(
    toolResult,
    { expanded: true, isPartial: false },
    theme,
    {},
  ))
  assert.match(expanded, /latest output/)
  assert.match(expanded, new RegExp(longArgument))
  assert.match(taskResult.messages[0].content[0].text, /earlier output 0/)
  assert.equal(taskResult.messages[48].content[0].arguments.value, longArgument)
  assert.equal(toolResult.content[0].text, modelVisibleOutput)
})

test('compact and expanded renderers retain exact failure diagnostics', async () => {
  const { createRenderers } = await import(`${pathToFileURL(RENDER).href}?test=${Date.now()}-${Math.random()}`)
  const renderers = createRenderers(fakeRuntime)
  const failed = result({
    exitCode: 2,
    stopReason: 'error',
    errorMessage: 'provider unavailable',
    stderr: 'child diagnostic',
  })

  for (const expanded of [false, true]) {
    const rendered = render(renderers.renderResult(
      { content: [{ type: 'text', text: 'Subagent failed.' }], details: failed, isError: true },
      { expanded, isPartial: false },
      theme,
      {},
    ))
    assert.match(rendered, /✗.*read-only/)
    assert.match(rendered, /Inspect the branch/)
    assert.match(rendered, /read .*file\.ts/)
    assert.match(rendered, /Final \*\*answer\*\*/)
    assert.match(rendered, /Exit code: 2/)
    assert.match(rendered, /Stop reason: error/)
    assert.match(rendered, /Error: provider unavailable/)
    assert.match(rendered, /Stderr: child diagnostic/)
    assert.match(rendered, /fake-provider\/fake-model/)
    assert.doesNotMatch(rendered, /parallel|chain|batch|step|aggregate|Total:/i)
  }
})

test('single task preserves the full model-visible output and direct task details', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-kit-subagent-truncate-'))
  const previousArgv1 = process.argv[1]
  const previousOutput = process.env.FAKE_PI_OUTPUT
  process.argv[1] = FAKE_PI
  process.env.FAKE_PI_OUTPUT = 'x'.repeat(60 * 1024)
  t.after(() => {
    process.argv[1] = previousArgv1
    if (previousOutput === undefined) delete process.env.FAKE_PI_OUTPUT
    else process.env.FAKE_PI_OUTPUT = previousOutput
    fs.rmSync(root, { recursive: true, force: true })
  })

  const tool = await loadTool()
  const execution = await tool.execute(
    'truncate',
    { task: 'Return a large result', profile: 'read-only' },
    undefined,
    undefined,
    {
      cwd: root,
      model: { provider: 'parent-provider', id: 'parent-model' },
      thinkingLevel: 'low',
      isProjectTrusted: () => false,
    },
  )

  const visible = execution.content[0].text
  assert.equal(Buffer.byteLength(visible, 'utf8'), 60 * 1024)
  assert.doesNotMatch(visible, /truncat/i)
  assert.equal(execution.details.task, 'Return a large result')
  assert.equal(execution.details.messages[0].content[0].text, visible)
  assert.equal('mode' in execution.details, false)
  assert.equal('results' in execution.details, false)
})

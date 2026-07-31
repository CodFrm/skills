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

test('renderers show mode progress, errors, expanded tasks, and usage', async () => {
  const { createRenderers } = await import(`${pathToFileURL(RENDER).href}?test=${Date.now()}-${Math.random()}`)
  const renderers = createRenderers(fakeRuntime)

  const call = render(renderers.renderCall(
    { tasks: [{ task: 'one', profile: 'write' }, { task: 'two', profile: 'read-only' }] },
    theme,
    {},
  ))
  assert.match(call, /subagent parallel \(2 tasks\)/i)
  assert.match(call, /write.*one/i)
  assert.match(call, /read-only.*two/i)

  const singleDetails = { mode: 'single', results: [result()] }
  const collapsed = render(renderers.renderResult(
    { content: [{ type: 'text', text: 'Final answer' }], details: singleDetails },
    { expanded: false, isPartial: false },
    theme,
    {},
  ))
  assert.match(collapsed, /✓.*read-only/)
  assert.match(collapsed, /read .*file\.ts/)
  assert.match(collapsed, /Final \*\*answer\*\*/)
  assert.match(collapsed, /2 turns.*↑1\.2k.*↓20.*R3.*W4.*\$0\.0123.*ctx:1\.5k.*fake-provider\/fake-model/)

  const expanded = render(renderers.renderResult(
    { content: [{ type: 'text', text: 'Final answer' }], details: singleDetails },
    { expanded: true, isPartial: false },
    theme,
    {},
  ))
  assert.match(expanded, /Task/)
  assert.match(expanded, /Inspect the branch/)
  assert.match(expanded, /Output/)
  assert.match(expanded, /Final \*\*answer\*\*/)

  const parallel = render(renderers.renderResult(
    {
      content: [{ type: 'text', text: 'running' }],
      details: {
        mode: 'parallel',
        results: [
          result({ task: 'running', exitCode: -1, messages: [], stopReason: undefined }),
          result({ task: 'done' }),
          result({ task: 'failed', exitCode: 2, stopReason: 'error', errorMessage: 'provider failed' }),
        ],
      },
    },
    { expanded: false, isPartial: true },
    theme,
    {},
  ))
  assert.match(parallel, /2\/3 done, 1 running/)
  assert.match(parallel, /provider failed/)

  const chain = render(renderers.renderResult(
    {
      content: [{ type: 'text', text: 'done' }],
      details: { mode: 'chain', results: [result({ step: 1 }), result({ step: 2, profile: 'write' })] },
    },
    { expanded: true, isPartial: false },
    theme,
    {},
  ))
  assert.match(chain, /Step 1.*read-only/)
  assert.match(chain, /Step 2.*write/)
  assert.match(chain, /Total: 4 turns/)
})

test('parallel caps model-visible task output at 50KB while details keep the full message', async t => {
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
    { tasks: [{ task: 'Return a large result', profile: 'read-only' }] },
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
  assert.match(visible, /Output truncated/)
  assert.ok(Buffer.byteLength(visible, 'utf8') < 52 * 1024, `visible output was ${Buffer.byteLength(visible, 'utf8')} bytes`)
  const full = execution.details.results[0].messages[0].content[0].text
  assert.equal(Buffer.byteLength(full, 'utf8'), 60 * 1024)
})

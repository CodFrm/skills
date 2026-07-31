'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const PLUGIN_ROOT = path.join(__dirname, '..')
const PACKAGE_JSON = path.join(PLUGIN_ROOT, 'package.json')
const EXTENSION = path.join(PLUGIN_ROOT, '.pi', 'extensions', 'dev-kit.ts')
const SKILLS_DIR = path.join(PLUGIN_ROOT, 'skills')
const BOOTSTRAP = path.join(SKILLS_DIR, 'using-dev-kit', 'SKILL.md')
const PI_TOOLS = path.join(SKILLS_DIR, 'using-dev-kit', 'references', 'pi-tools.md')
const DEVKIT_BIN = path.join(PLUGIN_ROOT, 'bin', 'devkit')

function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  return (match ? match[1] : content).trim()
}

async function loadExtension() {
  const handlers = new Map()
  const pi = {
    on(event, handler) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
  }
  const url = `${pathToFileURL(EXTENSION).href}?test=${Date.now()}-${Math.random()}`
  const mod = await import(url)
  mod.default(pi)
  return handlers
}

function one(handlers, event) {
  const found = handlers.get(event) ?? []
  assert.equal(found.length, 1, `expected one ${event} handler`)
  return found[0]
}

function textOf(message) {
  if (typeof message.content === 'string') return message.content
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
}

test('package.json exposes the shared skills and bootstrap extension as a Pi package', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))

  assert.equal(pkg.name, 'dev-kit')
  assert.ok(pkg.keywords.includes('pi-package'))
  assert.deepEqual(pkg.pi.skills, ['./skills'])
  assert.deepEqual(pkg.pi.extensions, ['./.pi/extensions/dev-kit.ts'])
  assert.equal(pkg.peerDependencies['@earendil-works/pi-coding-agent'], '*')
  assert.ok(fs.existsSync(EXTENSION))
  assert.ok(fs.existsSync(SKILLS_DIR))
})

test('extension registers transient context injection only', async () => {
  const handlers = await loadExtension()

  assert.equal((handlers.get('context') ?? []).length, 1, 'missing context handler')
  for (const event of ['session_start', 'session_before_compact', 'session_compact', 'agent_end']) {
    assert.equal((handlers.get(event) ?? []).length, 0, `unexpected ${event} handler`)
  }
})

test('package manifest owns skill discovery so package filters are not bypassed', async () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
  const handlers = await loadExtension()

  assert.deepEqual(pkg.pi.skills, ['./skills'])
  assert.equal((handlers.get('resources_discover') ?? []).length, 0)
})

test('context injects canonical using-dev-kit and Pi mapping as one transient user message', async () => {
  const handlers = await loadExtension()

  const user = { role: 'user', content: [{ type: 'text', text: 'Implement this change' }], timestamp: 1 }
  const result = await one(handlers, 'context')({ type: 'context', messages: [user] }, {})
  const injected = textOf(result.messages[0])

  assert.equal(result.messages.length, 2)
  assert.equal(result.messages[0].role, 'user')
  assert.equal(result.messages[1], user)
  assert.match(injected, /dev-kit:using-dev-kit bootstrap for pi/)
  assert.ok(injected.includes(stripFrontmatter(fs.readFileSync(BOOTSTRAP, 'utf8'))))
  assert.ok(injected.includes(fs.readFileSync(PI_TOOLS, 'utf8').trim()))
  assert.ok(injected.includes(`node "${DEVKIT_BIN}" <subcommand>`))
})

test('marker prevents duplicate bootstrap messages in one context', async () => {
  const handlers = await loadExtension()
  const context = one(handlers, 'context')
  const original = [{ role: 'user', content: [{ type: 'text', text: 'hello' }], timestamp: 1 }]

  const first = await context({ type: 'context', messages: original }, {})
  assert.equal(await context({ type: 'context', messages: first.messages }, {}), undefined)
})

test('later user runs in the same session still receive the transient bootstrap', async () => {
  const handlers = await loadExtension()
  const context = one(handlers, 'context')
  const original = [{ role: 'user', content: [{ type: 'text', text: 'continue' }], timestamp: 1 }]

  for (const handler of handlers.get('agent_end') ?? []) {
    await handler({ type: 'agent_end', messages: [] }, {})
  }
  const result = await context({ type: 'context', messages: original }, {})

  assert.equal(result.messages.length, 2)
  assert.match(textOf(result.messages[0]), /dev-kit:using-dev-kit bootstrap for pi/)
  assert.equal(result.messages[1], original[0])
})

test('bootstrap follows every leading compaction summary', async () => {
  const handlers = await loadExtension()
  const context = one(handlers, 'context')

  const firstSummary = { role: 'compactionSummary', summary: 'one', timestamp: 1 }
  const secondSummary = { role: 'compactionSummary', summary: 'two', timestamp: 2 }
  const user = { role: 'user', content: [{ type: 'text', text: 'continue' }], timestamp: 3 }
  const result = await context({ type: 'context', messages: [firstSummary, secondSummary, user] }, {})

  assert.equal(result.messages[0], firstSummary)
  assert.equal(result.messages[1], secondSummary)
  assert.equal(result.messages[2].role, 'user')
  assert.match(textOf(result.messages[2]), /dev-kit:using-dev-kit bootstrap for pi/)
  assert.equal(result.messages[3], user)
})

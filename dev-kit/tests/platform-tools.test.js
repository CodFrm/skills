'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const USING_DEV_KIT = path.join(__dirname, '..', 'skills', 'using-dev-kit')

function read(relativePath) {
  return fs.readFileSync(path.join(USING_DEV_KIT, relativePath), 'utf8')
}

test('using-dev-kit routes platform-specific tool names to one owned reference each', () => {
  const skill = read('SKILL.md')
  for (const platform of ['codex', 'claude', 'pi']) {
    assert.match(skill, new RegExp(`references/${platform}-tools\\.md`))
  }
})

test('Codex mapping uses the collaboration tools exposed by the current harness', () => {
  const mapping = read('references/codex-tools.md')
  for (const tool of ['spawn_agent', 'wait_agent', 'send_message', 'followup_task', 'interrupt_agent', 'list_agents', 'update_plan']) {
    assert.match(mapping, new RegExp(`\\b${tool}\\b`))
  }
  assert.doesNotMatch(mapping, /\bclose_agent\b/)
})

test('Claude mapping keeps native subagents and task tracking distinct', () => {
  const mapping = read('references/claude-tools.md')
  assert.match(mapping, /`Task`/)
  assert.match(mapping, /`TodoWrite`/)
  assert.match(mapping, /parallel/i)
})

test('Pi mapping does not invent a native subagent tool', () => {
  const mapping = read('references/pi-tools.md')
  assert.match(mapping, /0\.81\.1/)
  assert.match(mapping, /inline/)
  assert.match(mapping, /read,bash,edit,write,grep,find,ls/)
  assert.doesNotMatch(mapping, /`spawn_agent`|`Task` tool/)
})

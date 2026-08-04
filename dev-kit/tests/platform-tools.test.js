'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const USING_DEV_KIT = path.join(__dirname, '..', 'skills', 'using-dev-kit')

function read(relativePath) {
  return fs.readFileSync(path.join(USING_DEV_KIT, relativePath), 'utf8')
}

function readRoot(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
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

test('Pi mapping translates the logical namespace and stays within the base tool set', () => {
  const mapping = read('references/pi-tools.md')
  assert.match(mapping, /`dev-kit:<name>`/)
  assert.match(mapping, /`<name>`/)
  assert.match(mapping, /`\/skill:<name>`/)
  assert.match(mapping, /inline/)
  assert.match(mapping, /read,bash,edit,write,grep,find,ls/)
  assert.match(mapping, /Do not recursively launch another `pi` process/)
  assert.doesNotMatch(mapping, /verified against `@earendil-works\/pi-coding-agent` 0\.\d+/)
  assert.doesNotMatch(mapping, /`spawn_agent`|`Task` tool/)
})

test('Pi mapping and public guidance describe the single-task subagent contract', () => {
  const mapping = read('references/pi-tools.md')
  const catalog = readRoot('README.md')
  const packageReadme = readRoot('dev-kit/.pi/extensions/subagent/README.md')
  const notice = readRoot('dev-kit/.pi/extensions/subagent/NOTICE.md')

  assert.match(mapping, /one task|single-task/i)
  assert.match(mapping, /main session.*serial/is)
  assert.match(mapping, /multiple.*`subagent`.*calls/is)
  assert.match(mapping, /read-only.*write.*general/is)
  assert.match(mapping, /active tools.*deduplicat|deduplicat.*active tools/is)
  assert.match(mapping, /three-layer|three layers/i)
  assert.match(mapping, /`task`.*`profile`.*`model`.*`thinking`.*`cwd`/s)
  assert.match(mapping, /`tasks`.*`chain`.*`tools`.*reject|reject.*`tasks`.*`chain`.*`tools`/is)
  assert.doesNotMatch(mapping, /parallel mode|chain mode|concurrency pool/i)

  assert.match(catalog, /单任务|one-task|single-task/i)
  assert.doesNotMatch(catalog, /single、parallel 与 chain/i)

  assert.match(packageReadme, /task.*profile.*model.*thinking.*cwd/is)
  assert.match(packageReadme, /read-only.*write.*general/is)
  assert.match(packageReadme, /main session.*serial|主会话.*串行/is)
  assert.match(packageReadme, /parallel.*multiple.*calls|并行.*sibling.*calls/is)
  assert.match(packageReadme, /active tools.*subagent|subagent.*active tools/is)
  assert.match(packageReadme, /three-layer|three layers|三层/i)
  assert.match(packageReadme, /`tasks`.*`chain`.*`tools`.*(?:reject|拒绝)|(?:reject|拒绝).*`tasks`.*`chain`.*`tools`/is)
  assert.doesNotMatch(packageReadme, /single\/parallel\/chain execution model/i)
  assert.doesNotMatch(packageReadme, /concurrency limits?|concurrency cap/i)

  assert.match(notice, /Source:/)
  assert.match(notice, /Author: Mario Zechner/)
  assert.doesNotMatch(notice, /single\/parallel\/chain execution model/i)
  assert.doesNotMatch(notice, /concurrency limits?|streaming result collection|output cap/i)
})

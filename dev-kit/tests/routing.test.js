'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')

test('settled small changes bypass brainstorming', () => {
  const router = read('skills/using-dev-kit/SKILL.md')
  const brainstorming = read('skills/brainstorming/SKILL.md')
  const readme = read('README.md')

  assert.match(router, /Settled small change/)
  assert.match(router, /Use `test-driven-development` for behaviour/)
  assert.match(router, /If any requirement or boundary is undecided, route to `brainstorming`/)
  assert.doesNotMatch(brainstorming, /compact path when the request is already settled/)
  assert.match(readme, /已定案的小改动直接走 TDD 或项目检查/)
  assert.doesNotMatch(readme, /Every tracked change follows `brainstorming`/)
})

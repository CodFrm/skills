import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')

test('settled small changes keep the durable chain without reopening design', () => {
  const router = read('skills/using-dev-kit/SKILL.md')
  const brainstorming = read('skills/brainstorming/SKILL.md')
  const readme = read('README.md')

  assert.match(router, /Settled small change/)
  assert.match(router, /Every tracked change uses the spec\/workspace\/plan chain/)
  assert.match(brainstorming, /For a settled request, omit steps 3–5/)
  assert.match(brainstorming, /one compact TDD slice/)
  assert.match(readme, /需求已定案时走 compact path/)
  assert.match(readme, /小改动写一个 compact task/)
  assert.doesNotMatch(readme, /直接进入 TDD/)
})

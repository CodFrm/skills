import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')

test('settled small changes skip brainstorming consistently', () => {
  const router = read('skills/using-dev-kit/SKILL.md')
  const brainstorming = read('skills/brainstorming/SKILL.md')
  const readme = read('README.md')

  assert.match(router, /Settled small change/)
  assert.match(router, /No chain/)
  assert.match(brainstorming, /Not for: a settled small change/)
  assert.match(readme, /需求或边界仍未确定/)
  assert.doesNotMatch(readme, /需求已清楚但没写下来时同样适用/)
})

'use strict'

// Run: node --test dev-kit/tests/*.test.js
//
// The base Pi package ships nothing but skills, and that is a silent dependency: if pi.skills stops
// naming ./skills, `pi install` still succeeds and loads no dev-kit skill at all.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const PLUGIN_ROOT = path.join(__dirname, '..')

test('the base package exposes the shared skills to Pi and registers no extension of its own', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8'))

  assert.equal(pkg.name, 'dev-kit')
  assert.ok(pkg.keywords.includes('pi-package'))
  assert.deepEqual(pkg.pi.skills, ['./skills'])
  assert.equal(pkg.pi.extensions, undefined, 'the optional subagent package owns the only extension')
  assert.ok(fs.existsSync(path.join(PLUGIN_ROOT, 'skills')))
})

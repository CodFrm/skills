'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const PLUGIN_ROOT = path.join(REPO_ROOT, 'dev-kit')

test('Codex manifest packages the existing skills and plugin identity', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.codex-plugin', 'plugin.json'), 'utf8'))
  assert.equal(manifest.name, 'dev-kit')
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)
  assert.equal(manifest.skills, './skills/')
  assert.equal(manifest.interface.displayName, 'Dev Kit')
})

test('repo marketplace exposes the top-level dev-kit plugin directly', () => {
  const marketplacePath = path.join(REPO_ROOT, '.agents', 'plugins', 'marketplace.json')
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'))
  const entry = marketplace.plugins.find(plugin => plugin.name === 'dev-kit')

  assert.equal(marketplace.name, 'codfrm-skills')
  assert.deepEqual(entry.source, { source: 'local', path: './dev-kit' })
  assert.deepEqual(entry.policy, { installation: 'AVAILABLE', authentication: 'ON_INSTALL' })
  assert.equal(entry.category, 'Developer Tools')

  assert.equal(fs.realpathSync(path.join(REPO_ROOT, entry.source.path)), fs.realpathSync(PLUGIN_ROOT))
})

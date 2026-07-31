'use strict'

// Run: node --test dev-kit/tests/*.test.js
//
// Covers the facts that exist in more than one manifest. dev-kit ships through two marketplaces and
// two plugin manifests, so its version, description and identity are written down three times over —
// and nothing but memory kept them equal. c0de6b9 moved the spec commit onto the worktree branch and
// rewrote the chain in dev-kit/.claude-plugin/plugin.json; the copy in the root marketplace kept
// advertising the old order, and no test noticed. These assertions are that missing notice.
//
// What is deliberately *not* asserted: the Codex manifest's own description. It is a separate,
// shorter blurb for a different listing, not a copy of this one.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const PLUGIN_ROOT = path.join(REPO_ROOT, 'dev-kit')

const read = (...segments) => JSON.parse(fs.readFileSync(path.join(...segments), 'utf8'))

const claudeMarketplace = read(REPO_ROOT, '.claude-plugin', 'marketplace.json')
const codexMarketplace = read(REPO_ROOT, '.agents', 'plugins', 'marketplace.json')
const claudePlugin = read(PLUGIN_ROOT, '.claude-plugin', 'plugin.json')
const codexPlugin = read(PLUGIN_ROOT, '.codex-plugin', 'plugin.json')

const listing = claudeMarketplace.plugins.find(plugin => plugin.name === 'dev-kit')

test('every manifest names the same plugin', () => {
  assert.ok(listing, 'dev-kit is missing from .claude-plugin/marketplace.json')
  assert.ok(
    codexMarketplace.plugins.some(plugin => plugin.name === 'dev-kit'),
    'dev-kit is missing from .agents/plugins/marketplace.json',
  )
  assert.equal(claudePlugin.name, 'dev-kit')
  assert.equal(codexPlugin.name, 'dev-kit')
})

test('one version, written down three times', () => {
  assert.equal(listing.version, claudePlugin.version)
  assert.equal(codexPlugin.version, claudePlugin.version)
})

test('the marketplace listing advertises the same chain as the plugin it installs', () => {
  assert.equal(listing.description, claudePlugin.description)
})

test('identity does not fork between the listing and the two plugin manifests', () => {
  assert.deepEqual(listing.author, claudePlugin.author)
  assert.deepEqual(codexPlugin.author, claudePlugin.author)
  assert.equal(codexPlugin.homepage, claudePlugin.homepage)
  assert.equal(codexPlugin.repository, claudePlugin.repository)
  assert.equal(codexPlugin.license, claudePlugin.license)
})

test('both marketplaces are the same marketplace', () => {
  assert.equal(codexMarketplace.name, claudeMarketplace.name)
})

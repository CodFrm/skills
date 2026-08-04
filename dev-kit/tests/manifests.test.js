'use strict'

// Run: node --test dev-kit/tests/*.test.js
//
// Covers the facts that exist in more than one manifest. dev-kit ships through two marketplaces,
// two plugin manifests and a Pi package, so its version and identity are repeated — and nothing but
// memory kept them equal. c0de6b9 moved the spec commit onto the worktree branch and
// rewrote the chain in dev-kit/.claude-plugin/plugin.json; the copy in the root marketplace kept
// advertising the old order, and no test noticed. These assertions are that missing notice.
//
// The Claude marketplace/plugin share the long workflow description; Codex and Pi share the
// shorter listing copy. The two pairs are intentional rather than four prose copies drifting apart.

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
  const piPackage = read(PLUGIN_ROOT, 'package.json')
  assert.ok(listing, 'dev-kit is missing from .claude-plugin/marketplace.json')
  assert.ok(
    codexMarketplace.plugins.some(plugin => plugin.name === 'dev-kit'),
    'dev-kit is missing from .agents/plugins/marketplace.json',
  )
  assert.equal(claudePlugin.name, 'dev-kit')
  assert.equal(codexPlugin.name, 'dev-kit')
  assert.equal(piPackage.name, 'dev-kit')
})

test('one version across every install manifest', () => {
  const piPackage = read(PLUGIN_ROOT, 'package.json')
  assert.equal(listing.version, claudePlugin.version)
  assert.equal(codexPlugin.version, claudePlugin.version)
  assert.equal(piPackage.version, claudePlugin.version)
})

test('each package listing advertises the description owned by its harness', () => {
  const piPackage = read(PLUGIN_ROOT, 'package.json')
  assert.equal(listing.description, claudePlugin.description)
  assert.equal(piPackage.description, codexPlugin.description)
})

test('no published description advertises a review stage the workflow no longer runs', () => {
  const piPackage = read(PLUGIN_ROOT, 'package.json')
  const published = [
    listing.description,
    claudePlugin.description,
    codexPlugin.description,
    codexPlugin.interface.longDescription,
    codexPlugin.interface.shortDescription,
    piPackage.description,
  ]
  for (const description of published) {
    assert.doesNotMatch(description, /reviewed by a subagent|each commit reviewed|task review/)
  }
})

test('identity does not fork between install manifests', () => {
  const piPackage = read(PLUGIN_ROOT, 'package.json')
  assert.deepEqual(listing.author, claudePlugin.author)
  assert.deepEqual(codexPlugin.author, claudePlugin.author)
  assert.equal(codexPlugin.homepage, claudePlugin.homepage)
  assert.equal(codexPlugin.repository, claudePlugin.repository)
  assert.equal(codexPlugin.license, claudePlugin.license)
  assert.deepEqual(piPackage.author, claudePlugin.author)
  assert.equal(piPackage.homepage, claudePlugin.homepage)
  assert.equal(piPackage.repository, claudePlugin.repository)
  assert.equal(piPackage.license, claudePlugin.license)
})

test('both marketplaces are the same marketplace', () => {
  assert.equal(codexMarketplace.name, claudeMarketplace.name)
})

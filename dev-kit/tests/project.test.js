'use strict'

// Run: node --test dev-kit/tests/*.test.js
//
// These cover lib/project.js, which is the CLI's security boundary. The traversal cases are the
// reason this file exists: they are the ones a "looks obviously right" prefix check gets wrong, and
// nothing else in the kit re-checks them.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const { findRoot, resolveInside } = require('../lib/project')

// macOS puts temp dirs behind /var -> /private/var, and resolveInside compares realpaths, so the
// fixture root has to be realpath'd too or every assertion fails for the wrong reason.
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-test-')))
const root = path.join(tmp, 'repo')
const artifacts = path.join(root, '.dev-kit', 'artifacts')

test.before(() => {
  fs.mkdirSync(path.join(artifacts, 'demo'), { recursive: true })
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  fs.writeFileSync(path.join(artifacts, 'demo', 'index.html'), '<h1>hi</h1>')
  fs.writeFileSync(path.join(tmp, 'outside.txt'), 'SECRET')
  // An artifact directory can contain anything, including a symlink someone dropped in.
  fs.symlinkSync(path.join(tmp, 'outside.txt'), path.join(artifacts, 'escape-link'))
})

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

test('resolveInside: a real path inside the root resolves', async () => {
  assert.equal(await resolveInside(artifacts, 'demo/index.html'), path.join(artifacts, 'demo', 'index.html'))
})

test('resolveInside: the root itself resolves to the root', async () => {
  assert.equal(await resolveInside(artifacts, ''), artifacts)
})

test('resolveInside: a plain ../ escape is refused', async () => {
  assert.equal(await resolveInside(artifacts, '../../../outside.txt'), null)
})

test('resolveInside: a traversal eaten by earlier segments is refused', async () => {
  // The case a prefix check cannot see: this normalises to a path with no ".." left in it at all.
  assert.equal(await resolveInside(artifacts, 'demo/../../../../outside.txt'), null)
  assert.equal(await resolveInside(artifacts, 'demo/../../../..' + path.join(tmp, 'outside.txt')), null)
})

test('resolveInside: an absolute-looking request stays inside the root', async () => {
  // '/etc/passwd' must be read as a path relative to the root, and there is nothing there.
  assert.equal(await resolveInside(artifacts, '/etc/passwd'), null)
  assert.equal(await resolveInside(artifacts, '/demo/index.html'), path.join(artifacts, 'demo', 'index.html'))
})

test('resolveInside: a symlink inside the root pointing out of it is refused', async () => {
  assert.equal(await resolveInside(artifacts, 'escape-link'), null)
})

test('resolveInside: a symlinked root still resolves (the worktree case)', async () => {
  // Inside a git worktree, .dev-kit is a symlink back to the main repository. The root and the
  // target are both realpath'd, so this has to keep working rather than being read as an escape.
  const wt = path.join(tmp, 'worktree')
  await fsp.mkdir(wt, { recursive: true })
  await fsp.symlink(path.join(root, '.dev-kit'), path.join(wt, '.dev-kit'))
  const viaLink = path.join(wt, '.dev-kit', 'artifacts')
  assert.equal(await resolveInside(viaLink, 'demo/index.html'), path.join(artifacts, 'demo', 'index.html'))
  assert.equal(await resolveInside(viaLink, '../../outside.txt'), null)
})

test('resolveInside: a path that does not exist is refused, not invented', async () => {
  assert.equal(await resolveInside(artifacts, 'demo/nope.html'), null)
  assert.equal(await resolveInside(path.join(root, 'no-such-root'), 'x'), null)
})

test('findRoot: walks up to the nearest ancestor holding .git or .dev-kit', () => {
  const deep = path.join(artifacts, 'demo')
  assert.equal(fs.realpathSync(findRoot(deep)), root)
})

test('findRoot: .dev-kit alone is enough, and the nearest one wins', () => {
  const inner = path.join(root, 'packages', 'app')
  fs.mkdirSync(path.join(inner, '.dev-kit'), { recursive: true })
  assert.equal(fs.realpathSync(findRoot(inner)), inner)
})

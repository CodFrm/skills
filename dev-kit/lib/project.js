'use strict'

// Project root resolution and the path allow-list.
//
// This module is the security boundary: every path any command hands to the filesystem goes through
// resolveInside() first. It lives on its own so that a future command cannot quietly reimplement the
// check, and so it can be tested without standing up a server.

const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

// Where a file may be served from. Everything outside these is off limits.
const ROOTS = [
  { key: 'specs', rel: 'docs/specs', label: 'docs/specs' },
  { key: 'artifacts', rel: '.dev-kit/artifacts', label: '.dev-kit/artifacts' },
]

// A mockup is allowed to be a real package (see brainstorming's references/mockups.md), and once its
// dependencies are installed that is tens of thousands of files. Skipping these is also why a static
// bundle must be built into mockups/ itself rather than a nested dist/.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'target', '__pycache__', '.git'])

function findRoot(from) {
  let dir = path.resolve(from)
  for (;;) {
    if (fs.existsSync(path.join(dir, '.dev-kit')) || fs.existsSync(path.join(dir, '.git'))) return dir
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

// The one security check. Checking for a leading `../` would not be enough: `a/../../../etc/passwd`
// normalises to `etc/passwd`, the traversal having been eaten by the earlier segments, and a prefix
// check sees nothing at all. So the criterion is "does the landing point sit inside the root",
// applied after both have been fully resolved — symlinks included, since .dev-kit is itself a symlink
// back to the main repository when the caller is inside a worktree.
//
// Returns the resolved absolute path, or null when it does not land inside the root (which callers
// must treat as 404 — never as "serve it anyway").
async function resolveInside(rootDir, relPath) {
  let root, target
  try { root = await fsp.realpath(rootDir) } catch { return null }
  try { target = await fsp.realpath(path.resolve(root, '.' + path.sep + relPath)) } catch { return null }
  if (target !== root && !target.startsWith(root + path.sep)) return null
  return target
}

module.exports = { ROOTS, SKIP_DIRS, findRoot, resolveInside }

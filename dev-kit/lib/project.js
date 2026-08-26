'use strict'

// Project root resolution and the path boundary.
//
// The security boundary: every path any command hands to the filesystem goes through
// resolveInside() first. On its own so no command can reimplement the check, and so it can be
// tested without standing up a server.

const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

// Where the plans live. Pass it to resolveInside() as the root, never as a path under the project
// root — a checkout may link .dev-kit to another repository, and then the plan file's realpath is
// not under the project root.
const PLANS = '.dev-kit/plans'

// A mockup may be a real package (see brainstorming's references/mockups.md), and installed
// dependencies are tens of thousands of files. Also why a static bundle is built into mockups/
// itself rather than a nested dist/.
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

// The one security check. A leading-`../` or prefix check is not enough: `a/../../../etc/passwd`
// normalises to `etc/passwd` with no traversal left to see. So the criterion is "does the landing
// point sit inside the root", applied after both are fully resolved — symlinks included, since
// .dev-kit can itself be a symlink to another repository.
//
// Returns the resolved absolute path, or null — which callers must treat as 404, never as
// "serve it anyway".
async function resolveInside(rootDir, relPath) {
  let root, target
  try { root = await fsp.realpath(rootDir) } catch { return null }
  try { target = await fsp.realpath(path.resolve(root, '.' + path.sep + relPath)) } catch { return null }
  if (target !== root && !target.startsWith(root + path.sep)) return null
  return target
}

module.exports = { PLANS, SKIP_DIRS, findRoot, resolveInside }

'use strict'

// `devkit serve` — a read-only static server over the project's spec and artifact directories.
//
// It exists for one case the skills genuinely need: a UI mockup that cannot run a dev server has to
// be built to a static bundle and opened in a browser, and `file://` blocks ES module imports on
// origin grounds. Browsing specs and artifacts is convenience on top.

const fs = require('fs')
const fsp = require('fs/promises')
const http = require('http')
const path = require('path')

const { ROOTS, SKIP_DIRS, findRoot, resolveInside } = require('./project')

const MAX_ENTRIES = 500

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
}

// Pages this CLI generates itself need no script and no external anything, and neither does any file
// it serves that is not HTML. This is the policy that must not be loosened: the directory listing
// interpolates filenames, so script here would make a filename an XSS payload.
const CSP_PAGE = "default-src 'none'; style-src 'unsafe-inline'"
// An HTML artifact may carry its own inline script and styles — that is the entire point of `serve`
// — and every subresource it pulls has to come from this origin, which is why a self-contained
// mockup must not pull Tailwind or anything else off a CDN.
//
// What this does *not* buy is confinement, and the comment here used to claim it did. No CSP
// directive restricts where a document may navigate (`navigate-to` was specified and never shipped),
// so a script running under this policy can read same-origin files and carry them off in a URL it
// navigates to. The guarantee is therefore narrower than "nothing leaves this origin": it is that
// only text/html gets to run script at all. Everything else goes out under CSP_PAGE — .svg above
// all, which is an ordinary image right up until you click it in the listing, at which point it is a
// document with its own script.
const CSP_FILE = "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"

const cspFor = (type) => (type.startsWith('text/html') ? CSP_FILE : CSP_PAGE)

// Only 127.0.0.1 is bound, and that on its own stops nothing: a page anywhere on the internet can
// point a hostname it controls at 127.0.0.1 and then read every spec and artifact here as
// same-origin, with the random port the only thing it has to guess. So a request whose Host does not
// name this loopback server is refused before any path is looked at.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

// encodeURI deliberately leaves #, ? and & alone, because all three are legal *somewhere* in a URL —
// just not in a path segment, where a literal # truncates the path before the browser ever sends it
// and a literal & is an undefined entity inside the href attribute. So a listed `a#b.md` linked to a
// 404 while being perfectly servable. Encoding segment by segment is what actually links to the file.
const encodePath = (p) => p.split('/').map((seg) => encodeURIComponent(seg)).join('/')

function hostAllowed(req) {
  const host = req.headers && req.headers.host
  if (typeof host !== 'string') return false
  const m = /^(\[[0-9a-fA-F:.]+\]|[^:]+)(?::(\d+))?$/.exec(host)
  if (!m || !LOCAL_HOSTS.has(m[1].toLowerCase())) return false
  const bound = req.socket && req.socket.localPort
  return !bound || !m[2] || Number(m[2]) === bound
}

function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
 body{font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;max-width:52rem;margin:2rem auto;padding:0 1rem;
      color:#1a1a1a;background:#fff}
 @media (prefers-color-scheme:dark){body{color:#e6e6e6;background:#161616}a{color:#79b8ff}}
 h1{font-size:1rem;font-weight:600;margin:0 0 1rem}
 ul{list-style:none;padding:0;margin:0} li{padding:.15rem 0}
 a{color:#0366d6;text-decoration:none} a:hover{text-decoration:underline}
 .dim{opacity:.55} .note{margin-top:1.2rem;padding:.6rem .8rem;border-left:3px solid #d0921a;opacity:.85}
</style></head><body>${body}</body></html>`
}

function send(res, status, type, body, csp) {
  res.writeHead(status, {
    'content-type': type,
    'content-security-policy': csp,
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  })
  res.end(body)
}

const notFound = (res, what) =>
  send(res, 404, 'text/html; charset=utf-8', page('not found', `<h1>404</h1><p>${esc(what)}</p><p><a href="/">back</a></p>`), CSP_PAGE)

function renderIndex(root, res) {
  const items = ROOTS.map((r) => (
    fs.existsSync(path.join(root, r.rel))
      ? `<li><a href="/${r.key}/">${esc(r.label)}/</a></li>`
      : `<li class="dim">${esc(r.label)}/ <span>— does not exist yet</span></li>`
  ))
  send(res, 200, 'text/html; charset=utf-8',
    page('dev-kit', `<h1>${esc(path.basename(root))}</h1><ul>${items.join('')}</ul>`), CSP_PAGE)
}

async function renderDir(res, dirPath, urlPath) {
  let entries
  try { entries = await fsp.readdir(dirPath, { withFileTypes: true }) } catch { return notFound(res, urlPath) }

  entries = entries.filter((e) => !(e.isDirectory() && SKIP_DIRS.has(e.name)))
  entries.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name))

  const truncated = entries.length > MAX_ENTRIES
  const shown = truncated ? entries.slice(0, MAX_ENTRIES) : entries

  const parent = urlPath.replace(/\/$/, '').split('/').slice(0, -1).join('/') + '/'
  const rows = shown.map((e) => {
    const href = encodePath(urlPath + e.name + (e.isDirectory() ? '/' : ''))
    return `<li><a href="${href}">${esc(e.name)}${e.isDirectory() ? '/' : ''}</a></li>`
  })

  // "this is all there is" and "it did not fit" must not render the same.
  const note = truncated
    ? `<p class="note">Showing the first ${MAX_ENTRIES} of ${entries.length} entries — the rest are not listed.
       Directories like node_modules and dist are skipped entirely.</p>`
    : ''

  send(res, 200, 'text/html; charset=utf-8',
    page(urlPath, `<h1>${esc(urlPath)}</h1><ul><li><a href="${encodePath(parent)}">../</a></li>${rows.join('')}</ul>${note}`),
    CSP_PAGE)
}

function serveFile(res, filePath) {
  const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'content-security-policy': cspFor(type),
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  })
  fs.createReadStream(filePath).on('error', () => res.destroy()).pipe(res)
}

async function handle(root, req, res) {
  if (!hostAllowed(req)) {
    return send(res, 403, 'text/plain; charset=utf-8', 'devkit serve answers to 127.0.0.1 and localhost only\n', CSP_PAGE)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'text/plain; charset=utf-8', 'read-only\n', CSP_PAGE)
  }

  let urlPath
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { return notFound(res, req.url) }
  if (urlPath.includes('\0')) return notFound(res, req.url)
  if (urlPath === '/') return renderIndex(root, res)

  const [, key, ...rest] = urlPath.split('/')
  const spec = ROOTS.find((r) => r.key === key)
  if (!spec) return notFound(res, urlPath)

  const target = await resolveInside(path.join(root, spec.rel), rest.join('/'))
  if (!target) return notFound(res, urlPath)

  let st
  try { st = await fsp.stat(target) } catch { return notFound(res, urlPath) }

  if (st.isDirectory()) {
    if (!urlPath.endsWith('/')) {
      res.writeHead(301, { location: encodePath(urlPath + '/') })
      return res.end()
    }
    const index = path.join(target, 'index.html')
    if (fs.existsSync(index)) return serveFile(res, index)
    return renderDir(res, target, urlPath)
  }
  return serveFile(res, target)
}

function cmdServe(argv) {
  const root = findRoot(process.cwd())
  if (!root) {
    console.error('devkit: no project root found (looked upwards for .git or .dev-kit)')
    return 1
  }

  const i = argv.indexOf('--port')
  const pinned = i >= 0 ? Number(argv[i + 1]) : null
  if (i >= 0 && (!Number.isInteger(pinned) || pinned < 1 || pinned > 65535)) {
    console.error('devkit: --port needs an integer between 1 and 65535')
    return 1
  }

  const server = http.createServer((req, res) => {
    handle(root, req, res).catch(() => {
      if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'error\n', CSP_PAGE)
      else res.destroy()
    })
  })

  // A fixed default port is exactly the one the instance you already have open would be holding, so
  // the default is drawn at random and one project per instance is the normal case.
  let attempts = 0
  const pick = () => (pinned ? pinned + attempts : 10000 + Math.floor(Math.random() * 10000))

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts < 10) { attempts++; return server.listen(pick(), '127.0.0.1') }
    console.error(`devkit: ${err.message}`)
    process.exitCode = 1
  })
  server.on('listening', () => {
    console.log(`dev-kit serving ${root}`)
    console.log(`  http://127.0.0.1:${server.address().port}/`)
    console.log('  read-only; docs/specs/ and .dev-kit/artifacts/ only. Ctrl-C to stop.')
  })
  server.listen(pick(), '127.0.0.1')
  return 0
}

module.exports = { cmdServe, handle }

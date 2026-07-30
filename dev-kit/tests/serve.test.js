'use strict'

// Run: node --test dev-kit/tests/*.test.js
//
// Covers lib/serve.js by driving handle() in process. The interesting failures are not crashes but
// the ones that keep answering 200 while handing out something they should not:
//
//   the two CSP strings   Loosening CSP_PAGE turns a filename into an XSS payload; handing CSP_FILE
//                         to a .svg lets an image execute. Both are written out literally below — a
//                         test that imports the constant it checks cannot fail when it changes.
//   the boundary wiring   project.test.js proves resolveInside() correct; nothing proved handle()
//                         calls it with the right root. The traversal cases here go through the URL.
//   the generated links   A listing that links to a 404 is a bug you only find by following one.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { Writable } = require('node:stream')

const { handle } = require('../lib/serve')

const CSP_PAGE = "default-src 'none'; style-src 'unsafe-inline'"
const CSP_FILE = "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"

const MAX_ENTRIES = 500

// macOS puts temp dirs behind /var -> /private/var and the boundary compares realpaths, so the
// fixture root has to be realpath'd too or every assertion fails for the wrong reason.
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-serve-')))
const root = path.join(tmp, 'repo')
const specs = path.join(root, 'docs', 'specs')
const artifacts = path.join(root, '.dev-kit', 'artifacts')

// Three secrets at three distances, so a leak says which argument was wrong: outside the project,
// inside it but outside both served roots, and behind a symlinked directory.
const OUTSIDE = 'SECRET-OUTSIDE-THE-PROJECT'
const IN_ROOT = 'SECRET-IN-THE-PROJECT-ROOT'
const VIA_LINK = 'SECRET-BEHIND-A-SYMLINK'

// A mockup carrying inline script and style is the case `serve` exists for; it keeps the permissive
// policy while the .svg beside it does not.
const MOCKUP = '<!doctype html><title>m</title><style>body{color:#111}</style><script>document.title="ran"</script>'
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/specs/design.md")</script></svg>'

const write = (p, body) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body) }

test.before(() => {
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  fs.mkdirSync(specs, { recursive: true })
  fs.mkdirSync(artifacts, { recursive: true })

  write(path.join(tmp, 'outside.txt'), OUTSIDE)
  write(path.join(tmp, 'outside-dir', 'loot.txt'), VIA_LINK)
  write(path.join(root, 'root-secret.txt'), IN_ROOT)

  write(path.join(specs, 'design.md'), '# design\n')
  write(path.join(specs, 'mock.html'), MOCKUP)
  write(path.join(specs, 'diagram.svg'), SVG)
  write(path.join(specs, 'shot.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  write(path.join(artifacts, 'note.txt'), 'artifact\n')

  // Path-position characters that encodeURI leaves alone, and two names that are HTML if the
  // listing forgets to escape them.
  write(path.join(specs, 'a#b.md'), 'hash body\n')
  write(path.join(specs, 'q?x&y.md'), 'query body\n')
  // A literal percent catches a second decode being added anywhere on the way to the boundary.
  write(path.join(specs, 'read%20me.md'), 'percent body\n')
  write(path.join(specs, '<img src=x onerror=alert(1)>.md'), 'tag body\n')
  write(path.join(specs, 'x"onmouseover=alert(1) y.md'), 'quote body\n')

  write(path.join(specs, 'sub', 'index.html'), '<h1>sub index</h1>')
  write(path.join(specs, 'plain', 'one.md'), 'one\n')

  // An artifact directory can contain anything, including symlinks someone dropped in.
  // project.test.js only covers the file case.
  fs.symlinkSync(path.join(tmp, 'outside.txt'), path.join(specs, 'escape-file'))
  fs.symlinkSync(path.join(tmp, 'outside-dir'), path.join(specs, 'escape-dir'))

  // SKIP_DIRS is keyed on directories, so the file called `vendor` has to survive the filter.
  write(path.join(specs, 'skips', 'keep.md'), 'keep\n')
  write(path.join(specs, 'skips', 'vendor'), 'a file, not a directory\n')
  write(path.join(specs, 'skips', 'node_modules', 'buried.md'), 'buried\n')
  write(path.join(specs, 'skips', 'dist', 'buried.md'), 'buried\n')

  fs.mkdirSync(path.join(specs, 'many'), { recursive: true })
  for (let i = 0; i <= MAX_ENTRIES; i++) {
    fs.writeFileSync(path.join(specs, 'many', `f${String(i).padStart(3, '0')}.md`), 'x')
  }
})

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

// --- driving handle() ----------------------------------------------------------------------------

// serveFile pipes a read stream into the response, so the double has to be a real writable.
class Capture extends Writable {
  constructor() {
    super()
    this.chunks = []
    this.status = 0
    this.headers = {}
    this.headersSent = false
  }

  _write(chunk, _enc, cb) { this.chunks.push(chunk); cb() }

  writeHead(status, headers = {}) {
    this.status = status
    for (const [k, v] of Object.entries(headers)) this.headers[k.toLowerCase()] = v
    this.headersSent = true
    return this
  }

  get body() { return Buffer.concat(this.chunks).toString('utf8') }
}

// `url` is the raw request target, exactly as it comes off the wire — percent-escapes and all.
async function req(url, { method = 'GET', host = '127.0.0.1', localPort } = {}) {
  const res = new Capture()
  const settled = new Promise((resolve) => { res.on('finish', resolve); res.on('close', resolve) })
  const headers = host === null ? {} : { host }
  await handle(root, { method, url, headers, socket: localPort ? { localPort } : {} }, res)
  await settled
  return res
}

const links = (html) => [...html.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map((m) => ({ href: m[1], text: m[2] }))
const linkTo = (html, text) => links(html).find((l) => l.text === text)

// --- the two policies ----------------------------------------------------------------------------

test('every page this CLI generates itself is served under a policy that cannot run script', async () => {
  // renderDir interpolates filenames into this page: allow script here and `<img src=x onerror=…>`
  // stops being escaped text and starts being a payload.
  for (const url of ['/', '/specs/', '/specs/plain/', '/nope']) {
    assert.equal((await req(url)).headers['content-security-policy'], CSP_PAGE, url)
  }
})

test('an HTML artifact keeps the policy that lets its own inline script and styles run', async () => {
  // Loosening this breaks self-contained mockups; opening it to an external origin is what the
  // "no CDN" rule in the skills forbids.
  const res = await req('/specs/mock.html')
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8')
  assert.equal(res.headers['content-security-policy'], CSP_FILE)
  assert.match(res.headers['content-security-policy'], /script-src [^;]*'unsafe-inline'/)
})

test('an SVG is still an image, but is not allowed to run the script inside it', async () => {
  // Under CSP_FILE this file executes on direct navigation, reads a sibling spec same-origin and
  // leaves with it in a URL — CSP has no directive that stops a document navigating away. Keeping
  // image/svg+xml keeps diagrams rendering; the policy is what removes the script.
  const res = await req('/specs/diagram.svg')
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'image/svg+xml', 'an SVG diagram must still render as one')
  assert.equal(res.headers['content-security-policy'], CSP_PAGE)
  assert.doesNotMatch(res.headers['content-security-policy'], /script-src/)
})

test('nothing but text/html is handed the policy that permits script', async () => {
  for (const url of ['/specs/design.md', '/specs/shot.png', '/specs/diagram.svg', '/artifacts/note.txt']) {
    assert.equal((await req(url)).headers['content-security-policy'], CSP_PAGE, url)
  }
})

test('every response carries nosniff and no-store', async () => {
  for (const url of ['/', '/specs/', '/specs/mock.html', '/specs/shot.png']) {
    const res = await req(url)
    assert.equal(res.headers['x-content-type-options'], 'nosniff', url)
    assert.equal(res.headers['cache-control'], 'no-store', url)
  }
})

// --- the boundary, driven through the URL --------------------------------------------------------

test('the served roots are reachable and are the only thing reachable', async () => {
  // The other half of the traversal cases: if the root handed to resolveInside were ever wrong
  // these would 404 too, so the escapes below cannot pass by refusing everything.
  assert.equal((await req('/specs/design.md')).status, 200)
  assert.equal((await req('/artifacts/note.txt')).status, 200)
  assert.equal((await req('/etc/passwd')).status, 404)
  assert.equal((await req('/docs/specs/design.md')).status, 404)
})

test('a traversal out of the served root is refused however it is spelled', async () => {
  // `/specs/../x` never reaches the boundary — the URL parser folds the dot segment away, and so
  // does `%2e%2e`. The encoded slash arrives intact as `../../root-secret.txt`, which is the case
  // a prefix check waves through.
  const escapes = [
    '/specs/../root-secret.txt',
    '/specs/%2e%2e/root-secret.txt',
    '/specs/..%2f..%2froot-secret.txt',
    '/specs/%2e%2e%2f%2e%2e%2froot-secret.txt',
    '/specs/design.md/../../../root-secret.txt',
    '/specs/..%2f..%2f..%2foutside.txt',
    '/specs/%252e%252e%252froot-secret.txt',
    '//etc/passwd',
    '/specs//etc/passwd',
    '/specs/%2fetc%2fpasswd',
  ]
  for (const url of escapes) {
    const res = await req(url)
    assert.equal(res.status, 404, url)
    for (const secret of [OUTSIDE, IN_ROOT, VIA_LINK]) {
      assert.ok(!res.body.includes(secret), `${url} leaked ${secret}`)
    }
  }
})

test('a symlink out of the served root is refused, whether it points at a file or a directory', async () => {
  // Both are listed, because readdir reports the link itself. Following one is what must not happen.
  // A symlinked directory is the one that would turn the whole tree below it into a listing.
  const listing = (await req('/specs/')).body
  assert.ok(linkTo(listing, 'escape-file'), 'the link is visible in the listing')
  assert.ok(linkTo(listing, 'escape-dir'), 'the link is visible in the listing')

  const file = await req('/specs/escape-file')
  assert.equal(file.status, 404)
  assert.ok(!file.body.includes(OUTSIDE))

  const dir = await req('/specs/escape-dir/')
  assert.equal(dir.status, 404)
  assert.ok(!dir.body.includes('loot.txt'), 'a directory outside the root must not be enumerated')

  const through = await req('/specs/escape-dir/loot.txt')
  assert.equal(through.status, 404)
  // The 404 page echoes the path asked for, so it is the file's contents that must not appear.
  assert.ok(!through.body.includes(VIA_LINK))
})

test('a null byte in the path is refused rather than passed to the filesystem', async () => {
  for (const url of ['/specs/%00', '/specs/design.md%00.png', '/specs/%00../root-secret.txt']) {
    assert.equal((await req(url)).status, 404, url)
  }
})

test('a request that cannot be parsed as a URL is a 404, not a crash', async () => {
  assert.equal((await req('/specs/%zz')).status, 404)
})

// --- method, redirect, index ---------------------------------------------------------------------

test('anything but GET and HEAD is refused: the server is read-only', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const res = await req('/specs/design.md', { method })
    assert.equal(res.status, 405, method)
    assert.match(res.body, /read-only/)
    assert.equal(res.headers['content-security-policy'], CSP_PAGE)
  }
  assert.equal((await req('/specs/design.md', { method: 'HEAD' })).status, 200)
})

test('a directory without a trailing slash redirects to one', async () => {
  // Without this, every relative link inside the listing resolves one level too high.
  const res = await req('/specs/plain')
  assert.equal(res.status, 301)
  assert.equal(res.headers.location, '/specs/plain/')
})

test('a directory holding index.html serves it instead of a listing', async () => {
  const res = await req('/specs/sub/')
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8')
  assert.match(res.body, /sub index/)
  assert.equal(res.headers['content-security-policy'], CSP_FILE, 'it is an artifact, not a generated page')
})

test('the root page lists the served directories and says which do not exist yet', async () => {
  const res = await req('/')
  assert.equal(res.status, 200)
  assert.equal(linkTo(res.body, 'docs/specs/').href, '/specs/')
  assert.equal(linkTo(res.body, '.dev-kit/artifacts/').href, '/artifacts/')
})

// --- the listing ---------------------------------------------------------------------------------

test('a listing links to files with every path-position character encoded', async () => {
  // encodeURI leaves #, ? and & alone: `a#b.md` linked to `/specs/a#b.md`, the browser sent
  // `/specs/a`, and the file 404'd while being perfectly servable by hand.
  const listing = (await req('/specs/')).body

  assert.equal(linkTo(listing, 'a#b.md').href, '/specs/a%23b.md')
  assert.equal(linkTo(listing, 'q?x&amp;y.md').href, '/specs/q%3Fx%26y.md')
  // Escaped once, decoded exactly once: a second decode anywhere between here and resolveInside
  // turns this into a 404 for a file that exists.
  assert.equal(linkTo(listing, 'read%20me.md').href, '/specs/read%2520me.md')

  const round = [['a#b.md', 'hash body'], ['q?x&amp;y.md', 'query body'], ['read%20me.md', 'percent body']]
  for (const [name, body] of round) {
    const res = await req(linkTo(listing, name).href)
    assert.equal(res.status, 200, `following the listing's own link for ${name}`)
    assert.match(res.body, new RegExp(body))
  }

  // Nothing that could end an attribute or start a tag may survive into an href.
  for (const { href } of links(listing)) assert.doesNotMatch(href, /[<>"'&#? ]/)
})

test('a filename that is HTML is escaped into the listing rather than rendered', async () => {
  const listing = (await req('/specs/')).body
  assert.match(listing, /&lt;img src=x onerror=alert\(1\)&gt;\.md/)
  assert.doesNotMatch(listing, /<img src=x/)
  assert.match(listing, /x&quot;onmouseover=alert\(1\) y\.md/)
  assert.doesNotMatch(listing, /"onmouseover=/)
})

test('the parent link is encoded the same way as the entries', async () => {
  const res = await req('/specs/skips/')
  assert.equal(linkTo(res.body, '../').href, '/specs/')
})

test('directories that are build output are skipped, and files sharing their names are not', async () => {
  const res = await req('/specs/skips/')
  const names = links(res.body).map((l) => l.text)
  assert.ok(names.includes('keep.md'))
  assert.ok(names.includes('vendor'), 'the filter is about directories; a file called vendor is content')
  assert.ok(!names.includes('node_modules/'))
  assert.ok(!names.includes('dist/'))
})

test('a listing past MAX_ENTRIES is truncated, and says so rather than looking complete', async () => {
  // "this is all there is" and "it did not fit" must not render the same.
  const res = await req('/specs/many/')
  const entries = links(res.body).filter((l) => l.text !== '../')
  assert.equal(entries.length, MAX_ENTRIES)
  assert.match(res.body, new RegExp(`first ${MAX_ENTRIES} of ${MAX_ENTRIES + 1} entries`))

  const small = await req('/specs/plain/')
  assert.doesNotMatch(small.body, /are not listed/, 'a complete listing must not carry the warning')
})

// --- the Host header -----------------------------------------------------------------------------

test('a Host that does not name this loopback server is refused', async () => {
  // The DNS-rebinding case: a page on the internet points a hostname it controls at 127.0.0.1 and
  // reads every spec here as same-origin, with only the port to guess.
  for (const host of ['evil.example.com', 'evil.example.com:8080', 'rebind.test:41234', '127.0.0.1.nip.io', '']) {
    const res = await req('/specs/design.md', { host })
    assert.equal(res.status, 403, JSON.stringify(host))
    assert.ok(!res.body.includes('design'), 'nothing about the tree may leak to a rebound origin')
  }
  assert.equal((await req('/specs/design.md', { host: null })).status, 403, 'no Host at all')
})

test('the loopback names a browser actually sends are served', async () => {
  for (const host of ['127.0.0.1', 'localhost', 'LOCALHOST', '127.0.0.1:41234', 'localhost:41234', '[::1]:41234']) {
    assert.equal((await req('/specs/design.md', { host })).status, 200, host)
  }
})

test('a Host naming a loopback name but the wrong port is refused', async () => {
  // What survives a hostname check alone: the attacker knows the name and is guessing the port.
  assert.equal((await req('/specs/design.md', { host: '127.0.0.1:41234', localPort: 41234 })).status, 200)
  assert.equal((await req('/specs/design.md', { host: '127.0.0.1:41235', localPort: 41234 })).status, 403)
  assert.equal((await req('/specs/design.md', { host: 'localhost:41235', localPort: 41234 })).status, 403)
})

// --- over a real socket --------------------------------------------------------------------------

function listen() {
  return new Promise((resolve) => {
    const server = http.createServer((rq, rs) => { handle(root, rq, rs).catch(() => rs.destroy()) })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function fetchPath(port, target, headers = {}) {
  return new Promise((resolve, reject) => {
    const rq = http.request({ host: '127.0.0.1', port, path: target, headers }, (rs) => {
      let body = ''
      rs.setEncoding('utf8')
      rs.on('data', (c) => { body += c })
      rs.on('end', () => resolve({ status: rs.statusCode, headers: rs.headers, body }))
    })
    rq.on('error', reject)
    rq.end()
  })
}

test('over a real socket, the link the listing prints is a link that works', async () => {
  // The cases above hand handle() a request target directly. This one takes the href out of the
  // generated HTML and puts it back on the wire, which is what a browser does.
  const server = await listen()
  try {
    const port = server.address().port
    const listing = await fetchPath(port, '/specs/')
    const href = linkTo(listing.body, 'a#b.md').href
    assert.equal(href, '/specs/a%23b.md')
    const followed = await fetchPath(port, href)
    assert.equal(followed.status, 200)
    assert.match(followed.body, /hash body/)
  } finally {
    server.close()
  }
})

test('over a real socket, the port in the Host header has to be the port we are bound to', async () => {
  const server = await listen()
  try {
    const port = server.address().port
    assert.equal((await fetchPath(port, '/specs/design.md')).status, 200, 'the Host node sends by default')
    assert.equal((await fetchPath(port, '/specs/design.md', { host: `localhost:${port}` })).status, 200)
    assert.equal((await fetchPath(port, '/specs/design.md', { host: `rebind.test:${port}` })).status, 403)
    assert.equal((await fetchPath(port, '/specs/design.md', { host: `127.0.0.1:${port + 1}` })).status, 403)
  } finally {
    server.close()
  }
})

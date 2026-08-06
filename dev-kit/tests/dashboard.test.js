'use strict'

// Run: node --test dev-kit/tests/dashboard.test.js
//
// Drives dashboard.handle() in process for routing, rendering and path policy, then starts the real
// CLI once to prove registry -> command dispatch -> port retry -> HTTP is wired end to end.

const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { Writable } = require('node:stream')

const { handle } = require('../lib/dashboard')

const CSP_PAGE = "default-src 'none'; style-src 'unsafe-inline'"
const CSP_FILE = "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-dashboard-test-')))
const alpha = path.join(tmp, 'alpha')
const beta = path.join(tmp, 'beta')
const sharedAlpha = path.join(tmp, 'alpha-dev-kit')
const ghost = path.join(tmp, 'gone')
const noPlans = path.join(tmp, 'no-plans')
const outside = path.join(tmp, 'outside.txt')
const projects = [
  { name: 'alpha<&', root: alpha },
  { name: 'beta', root: beta },
  { name: 'ghost', root: ghost },
  { name: 'no-plans', root: noPlans },
]

const write = (file, body) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

function plan({ status, goal, tasks, mode = 'subagent', worktree = '.dev-kit/worktrees/example' }) {
  const taskText = tasks.map((task) => `  - id: ${task.id}\n    goal: ${task.goal}\n    deps: [${task.deps.join(', ')}]\n    files: []\n    model: cheap\n    interfaces: null\n    status: ${task.status}\n    commit: ${task.commit || 'null'}\n    note: ${task.note || 'null'}`).join('\n')
  return `spec: docs/specs/example.md\nstatus: ${status}\nmode: ${mode}\nworktree: ${worktree}\ngoal: >-\n  ${goal}\ncontext:\n  - baseline green\n  - keep <literal> text escaped\ntasks:\n${taskText}\nreview:\n  status: running\n  axis: code\n  head: abc123\n  receipt: .dev-kit/reviews/example/code.md\n  fixes: [fix123]\n  note: review note\nverification:\n  status: pending\n  report: null\n  head: null\n  note: verification note\n`
}

test.before(() => {
  fs.mkdirSync(path.join(alpha, '.git'), { recursive: true })
  fs.mkdirSync(sharedAlpha, { recursive: true })
  fs.symlinkSync(sharedAlpha, path.join(alpha, '.dev-kit'))
  fs.mkdirSync(path.join(beta, '.git'), { recursive: true })
  fs.mkdirSync(path.join(beta, '.dev-kit'), { recursive: true })
  fs.mkdirSync(path.join(noPlans, '.git'), { recursive: true })

  write(path.join(sharedAlpha, 'plans', 'running.yaml'), plan({
    status: 'running',
    goal: 'Ship <script>alert(1)</script> safely',
    tasks: [
      { id: '1', goal: 'foundation', deps: [], status: 'done', commit: 'deadbee' },
      { id: '2', goal: 'alpha ready task', deps: ['1'], status: 'todo', note: 'do next' },
      { id: '3', goal: 'not ready yet', deps: ['2'], status: 'todo' },
    ],
  }))
  write(path.join(sharedAlpha, 'plans', 'ready.yaml'), plan({
    status: 'ready', goal: 'A ready plan', tasks: [{ id: '1', goal: 'draft the API', deps: [], status: 'todo' }],
  }))
  write(path.join(sharedAlpha, 'plans', 'draft.yaml'), plan({
    status: 'draft', goal: 'A draft plan', tasks: [{ id: '1', goal: 'not scheduled', deps: [], status: 'blocked' }],
  }))
  write(path.join(sharedAlpha, 'plans', 'stopped.yaml'), plan({
    status: 'stopped', goal: 'A stopped plan', tasks: [{ id: '1', goal: 'paused', deps: [], status: 'blocked' }],
  }))
  write(path.join(sharedAlpha, 'plans', 'done.yaml'), plan({
    status: 'done', goal: 'A completed plan', tasks: [{ id: '1', goal: 'complete', deps: [], status: 'done' }],
  }))
  write(path.join(sharedAlpha, 'plans', 'bad.yaml'), 'spec: x\nstatus: {broken}\n')
  write(path.join(beta, '.dev-kit', 'plans', 'beta-running.yaml'), plan({
    status: 'running', goal: 'Beta work', tasks: [{ id: '7', goal: 'beta ready task', deps: [], status: 'todo' }],
  }))

  write(path.join(alpha, 'docs', 'specs', 'design.md'), '# design\n')
  write(path.join(alpha, 'docs', 'specs', 'mock.html'), '<style>body{color:red}</style><script>document.title="ran"</script>')
  write(path.join(alpha, 'docs', 'specs', 'diagram.svg'), '<svg><script>alert(1)</script></svg>')
  write(path.join(alpha, 'docs', 'specs', 'a#b.md'), 'hash body\n')
  write(path.join(alpha, 'docs', 'specs', 'plain', 'one.md'), 'one\n')
  write(path.join(alpha, 'docs', 'specs', 'site', 'index.html'), '<h1>site index</h1>')
  write(path.join(alpha, 'docs', 'specs', 'skips', 'keep.md'), 'keep\n')
  write(path.join(alpha, 'docs', 'specs', 'skips', 'vendor'), 'file named vendor\n')
  write(path.join(alpha, 'docs', 'specs', 'skips', 'node_modules', 'buried.md'), 'buried\n')
  write(path.join(alpha, 'docs', 'specs', 'skips', 'dist', 'buried.md'), 'buried\n')
  for (let i = 0; i <= 500; i++) write(path.join(alpha, 'docs', 'specs', 'many', `f${String(i).padStart(3, '0')}.md`), 'x')
  write(path.join(sharedAlpha, 'artifacts', 'note.txt'), 'artifact\n')
  write(outside, 'SECRET-OUTSIDE\n')
  fs.symlinkSync(outside, path.join(alpha, 'docs', 'specs', 'escape'))
  fs.symlinkSync(outside, path.join(sharedAlpha, 'plans', 'escape.yaml'))
})

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

class Capture extends Writable {
  constructor() {
    super()
    this.chunks = []
    this.status = 0
    this.headers = {}
    this.headersSent = false
  }

  _write(chunk, _enc, cb) { this.chunks.push(Buffer.from(chunk)); cb() }

  writeHead(status, headers = {}) {
    this.status = status
    for (const [key, value] of Object.entries(headers)) this.headers[key.toLowerCase()] = value
    this.headersSent = true
    return this
  }

  get body() { return Buffer.concat(this.chunks).toString('utf8') }
}

async function req(url, { method = 'GET', host = '127.0.0.1', localPort } = {}) {
  const res = new Capture()
  const settled = new Promise((resolve) => { res.on('finish', resolve); res.on('close', resolve) })
  const headers = host === null ? {} : { host }
  await handle({ method, url, headers, socket: localPort ? { localPort } : {} }, res, { projects })
  await settled
  return res
}

const links = (html) => [...html.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map((m) => ({ href: m[1], text: m[2] }))
const linkTo = (html, text) => links(html).find((link) => link.text === text)

test('home renders project cards, plan counts, aggregate summary and disconnected/error states', async () => {
  const res = await req('/')
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-security-policy'], CSP_PAGE)
  assert.match(res.body, /4 projects · 2 running · 2 disconnected/)
  assert.match(res.body, /class="cards"/)
  assert.match(res.body, /grid-template-columns:repeat\(auto-fill,minmax\(18rem,1fr\)\)/)
  assert.match(res.body, /<a href="\/projects\/alpha%3C%26\/">alpha&lt;&amp;<\/a>/)
  assert.match(res.body, /<a class="tasks-link" href="\/tasks">→ Ready tasks \(3\)<\/a>/)
  assert.match(res.body, /running 1/)
  assert.match(res.body, /ready 1/)
  assert.match(res.body, /draft 1/)
  assert.match(res.body, /stopped 1/)
  assert.match(res.body, /done 1/)
  assert.match(res.body, /unable to parse 1/)
  assert.match(res.body, /class="card ghost"[\s\S]*disconnected/)
  assert.doesNotMatch(res.body, /<script>alert\(1\)<\/script>/)
})

test('/tasks aggregates only ready tasks across registered connected projects', async () => {
  const res = await req('/tasks')
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-security-policy'], CSP_PAGE)
  assert.match(res.body, /Ready — 3/)
  assert.match(res.body, /alpha ready task · deps: 1/)
  assert.match(res.body, /draft the API · deps: —/)
  assert.match(res.body, /beta ready task/)
  assert.doesNotMatch(res.body, /not ready yet/)
  assert.ok(res.body.indexOf('alpha&lt;&amp;') < res.body.indexOf('beta ready task'))
})

test('empty registry and empty ready-task views render their specified empty states', async () => {
  for (const [url, message] of [['/', /devkit project add &lt;path&gt;/], ['/tasks', /No ready tasks/]]) {
    const res = new Capture()
    const settled = new Promise((resolve) => res.on('finish', resolve))
    await handle({ method: 'GET', url, headers: { host: '127.0.0.1' }, socket: {} }, res, { projects: [] })
    await settled
    assert.equal(res.status, 200)
    assert.match(res.body, message)
    assert.match(res.body, /class="empty"/)
  }
})

test('project page groups plans in contract order, reports progress and links both browser faces', async () => {
  const res = await req('/projects/alpha%3C%26/')
  assert.equal(res.status, 200)
  assert.equal(linkTo(res.body, 'docs/specs/').href, '/projects/alpha%3C%26/specs/')
  assert.equal(linkTo(res.body, '.dev-kit/artifacts/').href, '/projects/alpha%3C%26/artifacts/')
  assert.match(res.body, /running[\s\S]*running[\s\S]*1\/3/)
  assert.match(res.body, /unable to parse[\s\S]*bad/)
  const running = res.body.indexOf('<h3>Running</h3>')
  const ready = res.body.indexOf('<h3>Ready</h3>')
  const draft = res.body.indexOf('<h3>Draft</h3>')
  const stopped = res.body.indexOf('<h3>Stopped</h3>')
  const done = res.body.indexOf('<h3>Done</h3>')
  const broken = res.body.indexOf('<h3>Unable to parse</h3>')
  assert.ok(running >= 0 && running < ready && ready < draft && draft < stopped && stopped < done && done < broken)
  assert.doesNotMatch(res.body, /<script>alert\(1\)<\/script>/)
})

test('plan page renders the complete reader-backed plan shape without serving YAML', async () => {
  const res = await req('/projects/alpha%3C%26/plans/running')
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-security-policy'], CSP_PAGE)
  for (const text of [
    'running', 'mode: subagent', 'worktree: .dev-kit/worktrees/example',
    'docs/specs/example.md', 'Ship &lt;script&gt;alert(1)&lt;/script&gt; safely',
    'baseline green', 'keep &lt;literal&gt; text escaped', 'Tasks',
    'alpha ready task', '1', 'deadbee', 'do next',
    'Review', 'running · axis: code', 'fix123', 'Verification', 'pending', 'verification note',
  ]) assert.ok(res.body.includes(text), text)
  assert.doesNotMatch(res.body, /^spec:/m, 'the route renders plan fields; it does not serve raw YAML')
})

test('a malformed plan gets its own line-numbered error page and does not break other pages', async () => {
  const bad = await req('/projects/alpha%3C%26/plans/bad')
  assert.equal(bad.status, 200)
  assert.equal(bad.headers['content-security-policy'], CSP_PAGE)
  assert.match(bad.body, /PlanError/)
  assert.match(bad.body, /line 2/)
  assert.match(bad.body, /flow mapping/)
  assert.equal((await req('/projects/alpha%3C%26/plans/running')).status, 200)
  assert.equal((await req('/')).status, 200)
})

test('unknown projects and plans are generated 404 pages', async () => {
  for (const url of ['/projects/nope/', '/projects/alpha%3C%26/plans/nope', '/nope']) {
    const res = await req(url)
    assert.equal(res.status, 404, url)
    assert.equal(res.headers['content-security-policy'], CSP_PAGE, url)
  }
})

test('a registered project is disconnected when its root or plans directory is missing', async () => {
  for (const [name, root] of [['ghost', ghost], ['no-plans', noPlans]]) {
    const res = await req(`/projects/${name}/`)
    assert.equal(res.status, 200)
    assert.match(res.body, /disconnected/)
    assert.match(res.body, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('specs and artifacts browse directories, prefer index.html and apply CSP by response', async () => {
  const listing = await req('/projects/alpha%3C%26/specs/')
  assert.equal(listing.status, 200)
  assert.equal(listing.headers['content-security-policy'], CSP_PAGE)
  assert.equal(linkTo(listing.body, 'a#b.md').href, '/projects/alpha%3C%26/specs/a%23b.md')
  assert.equal(linkTo(listing.body, '../').href, '/projects/alpha%3C%26/')

  const html = await req('/projects/alpha%3C%26/specs/mock.html')
  assert.equal(html.status, 200)
  assert.equal(html.headers['content-security-policy'], CSP_FILE)
  assert.match(html.body, /<script>/)

  const svg = await req('/projects/alpha%3C%26/specs/diagram.svg')
  assert.equal(svg.headers['content-type'], 'image/svg+xml')
  assert.equal(svg.headers['content-security-policy'], CSP_PAGE)

  const artifact = await req('/projects/alpha%3C%26/artifacts/note.txt')
  assert.equal(artifact.status, 200)
  assert.match(artifact.body, /artifact/)
  assert.equal(artifact.headers['content-security-policy'], CSP_PAGE)

  const redirect = await req('/projects/alpha%3C%26/specs/plain')
  assert.equal(redirect.status, 301)
  assert.equal(redirect.headers.location, '/projects/alpha%3C%26/specs/plain/')

  const index = await req('/projects/alpha%3C%26/specs/site/')
  assert.equal(index.status, 200)
  assert.match(index.body, /site index/)
  assert.equal(index.headers['content-security-policy'], CSP_FILE)

  const skips = await req('/projects/alpha%3C%26/specs/skips/')
  assert.match(skips.body, />keep\.md</)
  assert.match(skips.body, />vendor</, 'a file sharing a skipped directory name remains visible')
  assert.doesNotMatch(skips.body, />node_modules\//)
  assert.doesNotMatch(skips.body, />dist\//)

  const many = await req('/projects/alpha%3C%26/specs/many/')
  assert.equal(links(many.body).filter((link) => link.text !== '../').length, 500)
  assert.match(many.body, /first 500 of 501 entries/)
})

test('traversal and symlink escapes are refused independently on specs, artifacts and plans faces', async () => {
  const escapes = [
    '/projects/alpha%3C%26/specs/..%2f..%2foutside.txt',
    '/projects/alpha%3C%26/specs/escape',
    '/projects/alpha%3C%26/artifacts/..%2f..%2foutside.txt',
    '/projects/alpha%3C%26/plans/escape',
    '/projects/alpha%3C%26/plans/..%2f..%2foutside',
    '/projects/alpha%3C%26/plans/%2fetc%2fpasswd',
  ]
  for (const url of escapes) {
    const res = await req(url)
    assert.equal(res.status, 404, url)
    assert.ok(!res.body.includes('SECRET-OUTSIDE'), url)
  }
})

test('Host and method checks run before routing, and HEAD is bodyless', async () => {
  assert.equal((await req('/', { host: 'evil.example' })).status, 403)
  assert.equal((await req('/', { host: null })).status, 403)
  assert.equal((await req('/', { host: '127.0.0.1:41001', localPort: 41002 })).status, 403)
  assert.equal((await req('/', { host: 'localhost:41002', localPort: 41002 })).status, 200)
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const res = await req('/', { method })
    assert.equal(res.status, 405, method)
    assert.match(res.body, /read-only/)
  }
  const head = await req('/projects/alpha%3C%26/specs/design.md', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.body, '')
})

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function fetchPath(port, target) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: target }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }))
    })
    request.on('error', reject)
  })
}

function waitForDashboard(child, output, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`dashboard did not start:\n${output.text}`)), timeout)
    const inspect = () => {
      const match = output.text.match(/http:\/\/127\.0\.0\.1:(\d+)\//)
      if (!match) return
      clearTimeout(timer)
      resolve(Number(match[1]))
    }
    child.stdout.on('data', (chunk) => { output.text += chunk; inspect() })
    child.stderr.on('data', (chunk) => { output.text += chunk; inspect() })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      reject(new Error(`dashboard exited before listening (${code}, ${signal}):\n${output.text}`))
    })
  })
}

test('the CLI help exposes dashboard and a real process retries a busy pinned port', async () => {
  const bin = path.join(__dirname, '..', 'bin', 'devkit')
  const help = spawnSync(process.execPath, [bin, 'help'], { encoding: 'utf8' })
  assert.equal(help.status, 0)
  assert.match(help.stdout, /devkit dashboard \[--port <n>\]/)

  const xdg = path.join(tmp, 'xdg')
  const add = spawnSync(process.execPath, [bin, 'project', 'add', alpha, '--name', 'cli-alpha'], {
    encoding: 'utf8', env: { ...process.env, XDG_CONFIG_HOME: xdg },
  })
  assert.equal(add.status, 0, add.stderr)

  const blocker = await listen(http.createServer((_req, res) => res.end('occupied')))
  const busyPort = blocker.address().port
  assert.ok(busyPort < 65535)
  const child = spawn(process.execPath, [bin, 'dashboard', '--port', String(busyPort)], {
    env: { ...process.env, XDG_CONFIG_HOME: xdg }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = { text: '' }
  try {
    const port = await waitForDashboard(child, output)
    assert.equal(port, busyPort + 1, output.text)
    const home = await fetchPath(port, '/')
    assert.equal(home.status, 200)
    assert.match(home.body, /cli-alpha/)
  } finally {
    child.kill('SIGTERM')
    blocker.close()
  }
})

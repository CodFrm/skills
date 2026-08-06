'use strict'

// `devkit dashboard` — a user-registry-backed, read-only view of projects, plans, specs and
// artifacts. Static-serving and security helpers live here rather than importing lib/serve.js:
// dashboard replaces that command in the next slice and must remain complete after serve is gone.
//
// Every generated page is localised (en/zh) and theme-aware (?theme= pins light/dark; otherwise the
// client's prefers-color-scheme decides). State lives in URL query params: the page is zero-JS and
// switching language or theme is a link that keeps the other parameter.

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')

const { PLANS, SKIP_DIRS, resolveInside } = require('./project')
const { loadRegistry, registryPath } = require('./registry')
const { STRINGS, resolveLang, resolveTheme } = require('./i18n')
const {
  parsePlan, entryOf, textOf, taskNodes, taskNode, readyTasks,
} = require('./plan')

const MAX_ENTRIES = 500
const PLAN_STATUSES = ['running', 'ready', 'draft', 'stopped', 'done']

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

// Generated pages interpolate local filenames and plan prose, so they can style themselves but can
// never run script. User HTML under specs/artifacts is the one exception: self-contained mockups
// need inline script and style, with every subresource still confined to this origin.
const CSP_PAGE = "default-src 'none'; style-src 'unsafe-inline'"
const CSP_FILE = "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
const cspFor = (type) => (type.startsWith('text/html') ? CSP_FILE : CSP_PAGE)

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
))

// encodeURI leaves path-significant characters such as # and ? untouched. Encode each segment so
// every link generated from a project name, slug or filename reaches exactly that segment.
const encodePath = (value) => value.split('/').map((segment) => encodeURIComponent(segment)).join('/')
const projectPath = (project) => `/projects/${encodeURIComponent(project.name)}/`

function hostAllowed(req) {
  const host = req.headers && req.headers.host
  if (typeof host !== 'string') return false
  const match = /^(\[[0-9a-fA-F:.]+\]|[^:]+)(?::(\d+))?$/.exec(host)
  if (!match || !LOCAL_HOSTS.has(match[1].toLowerCase())) return false
  const bound = req.socket && req.socket.localPort
  return !bound || !match[2] || Number(match[2]) === bound
}

// The top-right toggle: current language/theme is plain dim text, the alternatives are links that
// keep the current page and the other parameter. "System" means no theme parameter at all.
function toggleHTML(ui) {
  const { lang, theme, encPath, strings } = ui
  const to = (l, t) => `${encPath}?lang=${l}${t ? `&theme=${t}` : ''}`
  const langLink = (label, value) => (lang === value ? `<span class="dim">${label}</span>` : `<a href="${to(value, theme)}">${label}</a>`)
  const themeLink = (label, value) => (theme === value ? `<span class="dim">${label}</span>` : `<a href="${to(lang, value)}">${label}</a>`)
  const system = theme === null ? `<span class="dim">${strings.themeSystem}</span>` : `<a href="${to(lang, null)}">${strings.themeSystem}</a>`
  return `<div class="toolbar">${langLink(strings.langZh, 'zh')}${langLink(strings.langEn, 'en')} · ${system}${themeLink(strings.themeLight, 'light')}${themeLink(strings.themeDark, 'dark')}</div>`
}

// Palette is expressed as custom properties: the base (light) is overridden by the client's dark
// media query, and an explicit data-theme always beats the media query because it is a selector on
// the html element itself.
function page(title, body, ui) {
  const lang = ui && ui.lang === 'zh' ? 'zh-CN' : 'en'
  const themeAttr = ui && ui.theme ? ` data-theme="${ui.theme}"` : ''
  const toggle = ui ? toggleHTML(ui) : ''
  return `<!doctype html><html lang="${lang}"${themeAttr}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
 :root{--bg:#fff;--fg:#1a1a1a;--link:#0366d6;--border:#d0d7de;--soft:#eaeef2}
 html[data-theme="light"]{--bg:#fff;--fg:#1a1a1a;--link:#0366d6;--border:#d0d7de;--soft:#eaeef2}
 @media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#e6e6e6;--link:#79b8ff;--border:#30363d;--soft:#2d2d2d}}
 html[data-theme="dark"]{--bg:#161616;--fg:#e6e6e6;--link:#79b8ff;--border:#30363d;--soft:#2d2d2d}
 body{font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;max-width:52rem;margin:2rem auto;padding:0 1rem;color:var(--fg);background:var(--bg)}
 h1{font-size:1rem;font-weight:600;margin:0 0 .4rem} h2{font-size:.95rem;margin:0 0 .2rem}
 h3{font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
 ul{list-style:none;padding:0;margin:0} li{padding:.15rem 0}
 a{color:var(--link);text-decoration:none} a:hover{text-decoration:underline}
 .sub{opacity:.55;margin:0 0 1rem}.dim{opacity:.55}.tasks-link{display:block;margin:1rem 0 .4rem;font-size:13px}
 .toolbar{float:right;font-size:12px;opacity:.8}.toolbar a,.toolbar span{margin-left:.5rem}
 .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(18rem,1fr));gap:.8rem;margin-top:.6rem}
 .card{border:1px solid var(--border);border-radius:8px;padding:.8rem .9rem;background:var(--bg)}.card.ghost{border-color:#bf8700;outline:1px dashed #bf8700}
 .root{font-size:12px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.counts,.meta{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
 .badge{display:inline-block;padding:0 .4rem;border-radius:10px;font-size:12px;line-height:1.5;border:1px solid}.st-running{color:#1a7f37;border-color:#1a7f37}.st-ready{color:#0969da;border-color:#0969da}.st-draft{color:#6e7781;border-color:#6e7781}.st-stopped,.st-ghost{color:#bf8700;border-color:#bf8700}.st-done{color:#6e7781;border-color:var(--border);opacity:.7}.st-error{color:#cf222e;border-color:#cf222e}
 .group{margin-top:1rem}.group h3{opacity:.6;margin:0 0 .2rem;border-bottom:1px solid var(--soft)}
 .row{padding:.5rem .2rem;border-bottom:1px solid var(--soft);display:flex;align-items:baseline;gap:.6rem}.row:last-child{border-bottom:0}.slug{font-weight:600;min-width:0}.goal{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.8}.prog{font-size:12px;opacity:.55;white-space:nowrap}
 .sec{margin:1.1rem 0}.sec h3{opacity:.6;margin:0 0 .3rem}.body{white-space:pre-wrap}.kv{display:grid;grid-template-columns:8rem 1fr;gap:.1rem .8rem;font-size:13px;margin-top:.8rem}.kv dt{opacity:.55}.kv dd{margin:0}
 .table{width:100%;border-collapse:collapse;font-size:13px}.table th{text-align:left;font-weight:600;opacity:.6;font-size:12px;padding:.3rem .5rem;border-bottom:1px solid var(--border)}.table td{padding:.35rem .5rem;border-bottom:1px solid var(--soft);vertical-align:top}.table td.goal{min-width:16rem;white-space:normal}
 .note{margin-top:.6rem;padding:.5rem .7rem;border-left:3px solid #d0921a;opacity:.85;font-size:13px}.empty{border:1px dashed var(--border);border-radius:8px;padding:1.4rem;text-align:center;opacity:.8}
</style></head><body><div class="dash">${toggle}${body}</div></body></html>`
}

function send(req, res, status, type, body, csp = CSP_PAGE, extra = {}) {
  res.writeHead(status, {
    'content-type': type,
    'content-security-policy': csp,
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    ...extra,
  })
  res.end(req.method === 'HEAD' ? '' : body)
}

const notFound = (req, res, what, ui) => {
  const strings = (ui && ui.strings) || STRINGS.en
  const back = (ui && ui.href) ? ui.href('/') : '/'
  return send(req, res, 404, 'text/html; charset=utf-8',
    page(strings.notFound, `<h1>404</h1><p>${esc(what)}</p><p><a href="${back}">${strings.backToProjects}</a></p>`, ui))
}

function errorName(error) {
  return error && error.name ? error.name : 'Error'
}

function errorText(error) {
  const line = error && error.line ? ` (line ${error.line})` : ''
  return `${errorName(error)}: ${error && error.message ? error.message : String(error)}${line}`
}

function badge(status, label = status) {
  const known = ['running', 'ready', 'draft', 'stopped', 'done']
  const cls = known.includes(status) ? status : status === 'disconnected' ? 'ghost' : 'error'
  return `<span class="badge st-${cls}">${esc(label)}</span>`
}

function scalarValues(node, key) {
  const entry = entryOf(node, key)
  if (!entry) return []
  if (entry.value.kind === 'seq') return entry.value.items.map((item) => item.kind === 'scalar' ? item.text : null)
  if (entry.value.kind === 'scalar' && entry.value.text !== null) return [entry.value.text]
  return []
}

function display(value) {
  return value === null || value === undefined || value === '' ? '—' : esc(value)
}

async function resolvedProjectRoot(project) {
  return resolveInside(project.root, '')
}

async function readPlan(planDir, name) {
  const slug = name.replace(/\.yaml$/, '')
  const file = await resolveInside(planDir, name)
  if (!file) return null
  try {
    const stat = await fsp.stat(file)
    if (!stat.isFile()) return null
    const doc = parsePlan(await fsp.readFile(file, 'utf8'))
    // readyTasks is both the shared ready definition and a semantic read of dependencies. Keeping it
    // beside parse means one bad plan becomes one error record rather than breaking an aggregate.
    const ready = readyTasks(doc)
    return { slug, file, doc, ready, status: textOf(doc.root, 'status'), goal: textOf(doc.root, 'goal') }
  } catch (error) {
    return { slug, file, error }
  }
}

async function plansFor(project) {
  if (!await resolvedProjectRoot(project)) return { disconnected: true, plans: [] }
  const planDir = path.join(project.root, PLANS)
  const resolvedDir = await resolveInside(planDir, '')
  if (!resolvedDir) return { disconnected: true, plans: [] }
  let names
  try { names = (await fsp.readdir(resolvedDir)).filter((name) => name.endsWith('.yaml')).sort() } catch {
    return { disconnected: true, plans: [] }
  }
  const plans = []
  for (const name of names) {
    const record = await readPlan(planDir, name)
    if (record) plans.push(record)
  }
  return { disconnected: false, plans, planDir }
}

function statusCounts(plans) {
  const counts = new Map(PLAN_STATUSES.map((status) => [status, 0]))
  let errors = 0
  for (const plan of plans) {
    if (plan.error || !counts.has(plan.status)) errors++
    else counts.set(plan.status, counts.get(plan.status) + 1)
  }
  return { counts, errors }
}

async function projectStates(projects) {
  const states = []
  for (const project of projects) states.push({ project, ...await plansFor(project) })
  return states
}

async function renderHome(req, res, projects, ui) {
  const strings = ui.strings
  if (projects.length === 0) {
    return send(req, res, 200, 'text/html; charset=utf-8', page(strings.dashboard,
      `<h1>${esc(strings.dashboard)}</h1><p class="sub">${strings.noProjects}</p><div class="empty">${strings.addFirstProject}</div>`, ui))
  }

  const states = await projectStates(projects)
  let running = 0
  let disconnected = 0
  let ready = 0
  const cards = states.map((state) => {
    if (state.disconnected) {
      disconnected++
      return `<div class="card ghost"><h2><a href="${ui.href(projectPath(state.project))}">${esc(state.project.name)}</a></h2><div class="root">${esc(state.project.root)} — ${strings.disconnected}</div><div class="counts">${badge('disconnected', strings.disconnected)}</div></div>`
    }
    const { counts, errors } = statusCounts(state.plans)
    running += counts.get('running')
    ready += state.plans.reduce((total, plan) => total + (plan.ready ? plan.ready.length : 0), 0)
    const badges = PLAN_STATUSES.flatMap((status) => counts.get(status) ? [badge(status, `${status} ${counts.get(status)}`)] : [])
    if (errors) badges.push(badge('error', strings.unableToParse(errors)))
    return `<div class="card"><h2><a href="${ui.href(projectPath(state.project))}">${esc(state.project.name)}</a></h2><div class="root">${esc(state.project.root)}</div><div class="counts">${badges.join('')}</div></div>`
  })
  const body = `<h1>${esc(strings.dashboard)}</h1><p class="sub">${strings.projectsSummary(projects.length, running, disconnected)}</p><a class="tasks-link" href="${ui.href('/tasks')}">${strings.readyTasksEntry(ready)}</a><div class="cards">${cards.join('')}</div>`
  return send(req, res, 200, 'text/html; charset=utf-8', page(strings.dashboard, body, ui))
}

async function renderTasks(req, res, projects, ui) {
  const strings = ui.strings
  const states = await projectStates(projects)
  const rows = []
  for (const state of states) {
    if (state.disconnected) continue
    for (const plan of state.plans) {
      if (plan.error) continue
      for (const task of plan.ready) {
        const node = taskNode(plan.doc, task.id)
        const deps = scalarValues(node, 'deps')
        const depText = deps.length ? deps.map(display).join(', ') : '—'
        rows.push(`<div class="row">${badge('ready')}<span class="slug">${esc(state.project.name)}</span><span class="goal">/ <a href="${ui.href(`${projectPath(state.project)}plans/${encodeURIComponent(plan.slug)}`)}">${esc(plan.slug)}</a> / ${strings.taskWord(esc(task.id))}: ${display(task.goal)} · ${strings.depsWord(depText)}</span></div>`)
      }
    }
  }
  const content = rows.length
    ? `<div class="group"><h3>${strings.readyCount(rows.length)}</h3>${rows.join('')}</div>`
    : `<div class="empty">${strings.noReadyTasks}</div>`
  return send(req, res, 200, 'text/html; charset=utf-8', page(strings.readyTasks,
    `<h1>${esc(strings.readyTasks)}</h1><p class="sub"><a href="${ui.href('/')}">${strings.backToProjects}</a></p>${content}`, ui))
}

function planProgress(plan) {
  const tasks = taskNodes(plan.doc)
  return `${tasks.filter((task) => textOf(task, 'status') === 'done').length}/${tasks.length}`
}

function planRow(project, plan, ui) {
  const strings = ui.strings
  if (plan.error) {
    return `<div class="row">${badge('error', strings.unableToParseLabel)}<span class="slug"><a href="${ui.href(`${projectPath(project)}plans/${encodeURIComponent(plan.slug)}`)}">${esc(plan.slug)}</a></span><span class="goal">${esc(errorText(plan.error))}</span></div>`
  }
  return `<div class="row">${badge(plan.status)}<span class="slug"><a href="${ui.href(`${projectPath(project)}plans/${encodeURIComponent(plan.slug)}`)}">${esc(plan.slug)}</a></span><span class="goal">${display(plan.goal)}</span><span class="prog">${planProgress(plan)}</span></div>`
}

async function renderProject(req, res, project, ui) {
  const strings = ui.strings
  const state = await plansFor(project)
  if (state.disconnected) {
    // The registered root or its plans directory is gone: the home card already carries the 失联
    // marker and the root path, so entering the project page is a 404 per the failure/recovery
    // contract.
    return notFound(req, res, project.name, ui)
  }

  const groups = []
  for (const status of PLAN_STATUSES) {
    const plans = state.plans.filter((plan) => !plan.error && plan.status === status)
    if (plans.length) groups.push(`<div class="group"><h3>${status[0].toUpperCase() + status.slice(1)}</h3>${plans.map((plan) => planRow(project, plan, ui)).join('')}</div>`)
  }
  const errors = state.plans.filter((plan) => plan.error || !PLAN_STATUSES.includes(plan.status))
  if (errors.length) groups.push(`<div class="group"><h3>${strings.unableToParseGroup}</h3>${errors.map((plan) => planRow(project, plan, ui)).join('')}</div>`)
  if (!groups.length) groups.push(`<div class="empty">${strings.noPlans}</div>`)

  const base = projectPath(project)
  const body = `<h1>${esc(project.name)}</h1><p class="sub">${esc(project.root)} · <a href="${ui.href(`${base}specs/`)}">docs/specs/</a> · <a href="${ui.href(`${base}artifacts/`)}">.dev-kit/artifacts/</a> · <a href="${ui.href('/')}">${strings.projectsWord}</a></p>${groups.join('')}`
  return send(req, res, 200, 'text/html; charset=utf-8', page(project.name, body, ui))
}

function nestedNode(doc, key) {
  const entry = entryOf(doc.root, key)
  return entry && entry.value.kind === 'map' ? entry.value : null
}

function mapValue(node, key) {
  if (!node) return null
  const entry = entryOf(node, key)
  if (!entry) return null
  if (entry.value.kind === 'scalar') return entry.value.text
  if (entry.value.kind === 'seq') return entry.value.items.map((item) => item.kind === 'scalar' ? item.text : null).filter((value) => value !== null).join(', ')
  return null
}

function mapLine(node, keys) {
  return keys.map((key) => `${key}: ${display(mapValue(node, key))}`).join(' · ')
}

function renderContext(doc) {
  const values = scalarValues(doc.root, 'context')
  return values.length ? `<ul>${values.map((value) => `<li>${display(value)}</li>`).join('')}</ul>` : '<span class="dim">—</span>'
}

function depsText(task) {
  const deps = scalarValues(task, 'deps')
  return deps.length ? deps.join(', ') : '—'
}

function renderTasksTable(doc) {
  const readyIds = new Set(readyTasks(doc).map((task) => task.id))
  const rows = taskNodes(doc).map((listed) => {
    const id = textOf(listed, 'id')
    // Resolve through the exported id reader too: duplicate ids become this plan's error page rather
    // than silently rendering whichever task an ad-hoc search happened to find first.
    const task = taskNode(doc, id)
    const status = textOf(task, 'status')
    const style = status === 'doing' ? 'running' : status === 'done' ? 'done' : status === 'blocked' ? 'stopped' : readyIds.has(id) ? 'ready' : 'draft'
    return `<tr><td>${display(id)}</td><td>${badge(style, status)}</td><td class="goal">${display(textOf(task, 'goal'))}</td><td>${esc(depsText(task))}</td><td class="dim">${display(textOf(task, 'commit'))}</td><td class="dim">${display(textOf(task, 'note'))}</td></tr>`
  })
  return `<table class="table"><tr><th>id</th><th>status</th><th>goal</th><th>deps</th><th>commit</th><th>note</th></tr>${rows.join('')}</table>`
}

async function renderPlan(req, res, project, slug, ui) {
  const strings = ui.strings
  const planDir = path.join(project.root, PLANS)
  const resolvedDir = await resolveInside(planDir, '')
  if (!resolvedDir) return notFound(req, res, slug, ui)
  const cleanSlug = slug.replace(/\.yaml$/, '')
  const name = `${cleanSlug}.yaml`
  let names
  try { names = await fsp.readdir(resolvedDir) } catch { return notFound(req, res, slug, ui) }
  if (!names.includes(name)) return notFound(req, res, slug, ui)
  const record = await readPlan(planDir, name)
  if (!record || record.slug !== cleanSlug) return notFound(req, res, slug, ui)
  const back = projectPath(project)
  if (record.error) {
    return send(req, res, 200, 'text/html; charset=utf-8', page(cleanSlug,
      `<h1>${esc(cleanSlug)}</h1><p class="sub"><a href="${ui.href(back)}">← ${esc(project.name)}</a></p><p class="note">${esc(errorText(record.error))}</p>`, ui))
  }

  try {
    const doc = record.doc
    const review = nestedNode(doc, 'review')
    const verification = nestedNode(doc, 'verification')
    const status = textOf(doc.root, 'status')
    const body = `<h1>${esc(cleanSlug)}</h1><p class="sub"><a href="${ui.href(back)}">← ${esc(project.name)}</a></p>
<div class="meta">${badge(status)}<span class="badge">mode: ${display(textOf(doc.root, 'mode'))}</span><span class="badge">worktree: ${display(textOf(doc.root, 'worktree'))}</span></div>
<dl class="kv"><dt>spec</dt><dd>${display(textOf(doc.root, 'spec'))}</dd><dt>review</dt><dd>${mapLine(review, ['status', 'axis'])}</dd><dt>verification</dt><dd>${display(verification && textOf(verification, 'status'))}</dd></dl>
<div class="sec"><h3>${strings.goalSection}</h3><div class="body">${display(textOf(doc.root, 'goal'))}</div></div>
<div class="sec"><h3>${strings.contextSection}</h3>${renderContext(doc)}</div>
<div class="sec"><h3>${strings.tasksSection}</h3>${renderTasksTable(doc)}</div>
<div class="sec"><h3>${strings.reviewSection}</h3><div class="body">${mapLine(review, ['status', 'axis', 'head', 'receipt', 'fixes', 'note'])}</div></div>
<div class="sec"><h3>${strings.verificationSection}</h3><div class="body">${mapLine(verification, ['status', 'report', 'head', 'note'])}</div></div>`
    return send(req, res, 200, 'text/html; charset=utf-8', page(cleanSlug, body, ui))
  } catch (error) {
    return send(req, res, 200, 'text/html; charset=utf-8', page(cleanSlug,
      `<h1>${esc(cleanSlug)}</h1><p class="sub"><a href="${ui.href(back)}">← ${esc(project.name)}</a></p><p class="note">${esc(errorText(error))}</p>`, ui))
  }
}

async function renderDir(req, res, dirPath, urlPath, ui) {
  let entries
  try { entries = await fsp.readdir(dirPath, { withFileTypes: true }) } catch { return notFound(req, res, urlPath, ui) }
  entries = entries.filter((entry) => !(entry.isDirectory() && SKIP_DIRS.has(entry.name)))
  entries.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name))
  const truncated = entries.length > MAX_ENTRIES
  const shown = truncated ? entries.slice(0, MAX_ENTRIES) : entries
  const parent = urlPath.replace(/\/$/, '').split('/').slice(0, -1).join('/') + '/'
  const rows = shown.map((entry) => {
    const href = ui.href(encodePath(urlPath + entry.name + (entry.isDirectory() ? '/' : '')))
    return `<li><a href="${href}">${esc(entry.name)}${entry.isDirectory() ? '/' : ''}</a></li>`
  })
  const note = truncated
    ? `<p class="note">${ui.strings.truncatedNote(MAX_ENTRIES, entries.length)}</p>`
    : ''
  return send(req, res, 200, 'text/html; charset=utf-8', page(urlPath,
    `<h1>${esc(urlPath)}</h1><ul><li><a href="${ui.href(encodePath(parent))}">../</a></li>${rows.join('')}</ul>${note}`, ui))
}

function serveFile(req, res, filePath) {
  const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'content-security-policy': cspFor(type),
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(filePath).on('error', () => res.destroy()).pipe(res)
}

async function renderStatic(req, res, project, face, rest, urlPath, ui) {
  const rel = face === 'specs' ? path.join('docs', 'specs') : path.join('.dev-kit', 'artifacts')
  const root = path.join(project.root, rel)
  const relPath = rest.join('/')
  const target = await resolveInside(root, relPath)
  if (!target) return notFound(req, res, urlPath, ui)
  let stat
  try { stat = await fsp.stat(target) } catch { return notFound(req, res, urlPath, ui) }
  if (!stat.isDirectory()) return serveFile(req, res, target)
  if (!urlPath.endsWith('/')) {
    // Keep the language/theme across the trailing-slash redirect.
    return send(req, res, 301, 'text/plain; charset=utf-8', '', CSP_PAGE, { location: encodePath(urlPath + '/') + `?${ui.qs}` })
  }
  const indexRel = relPath ? path.join(relPath, 'index.html') : 'index.html'
  const index = await resolveInside(root, indexRel)
  if (index) {
    try { if ((await fsp.stat(index)).isFile()) return serveFile(req, res, index) } catch {}
  }
  return renderDir(req, res, target, urlPath, ui)
}

async function handle(req, res, ctx = {}) {
  if (!hostAllowed(req)) return send(req, res, 403, 'text/plain; charset=utf-8', 'devkit dashboard answers to 127.0.0.1 and localhost only\n')
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, 'text/plain; charset=utf-8', 'read-only\n')

  let url
  try { url = new URL(req.url, 'http://localhost') } catch { return notFound(req, res, req.url, null) }
  let urlPath
  try { urlPath = decodeURIComponent(url.pathname) } catch { return notFound(req, res, req.url, null) }
  if (urlPath.includes('\0')) return notFound(req, res, req.url, null)

  const lang = resolveLang(req.headers['accept-language'], url.searchParams.get('lang'))
  const theme = resolveTheme(url.searchParams.get('theme'))
  const qs = (l, t) => `lang=${l}${t ? `&theme=${t}` : ''}`
  const ui = {
    lang, theme, strings: STRINGS[lang], path: urlPath, encPath: url.pathname, qs: qs(lang, theme),
    href: (p) => `${p}${p.includes('?') ? '&' : '?'}${qs(lang, theme)}`,
  }

  const projects = ctx.projects || await loadRegistry(ctx.registryFile || registryPath())
  if (urlPath === '/') return renderHome(req, res, projects, ui)
  if (urlPath === '/tasks') return renderTasks(req, res, projects, ui)

  const parts = urlPath.split('/')
  if (parts[1] !== 'projects' || !parts[2]) return notFound(req, res, urlPath, ui)
  const project = projects.find((entry) => entry.name === parts[2])
  if (!project) return notFound(req, res, urlPath, ui)

  if (parts.length === 4 && parts[3] === '') return renderProject(req, res, project, ui)
  if (parts[3] === 'plans' && parts.length === 5 && parts[4]) return renderPlan(req, res, project, parts[4], ui)
  if ((parts[3] === 'specs' || parts[3] === 'artifacts') && parts.length >= 5) {
    return renderStatic(req, res, project, parts[3], parts.slice(4), urlPath, ui)
  }
  return notFound(req, res, urlPath, ui)
}

function parsePort(argv) {
  if (argv.length === 0) return { pinned: null }
  if (argv.length !== 2 || argv[0] !== '--port') return { error: 'usage: devkit dashboard [--port <n>]' }
  const pinned = Number(argv[1])
  if (!Number.isInteger(pinned) || pinned < 1 || pinned > 65535) return { error: '--port needs an integer between 1 and 65535' }
  return { pinned }
}

async function cmdDashboard(argv, io = {}) {
  const out = io.out || ((line) => console.log(line))
  const err = io.err || ((line) => console.error(line))
  const parsed = parsePort(argv)
  if (parsed.error) { err(`devkit: ${parsed.error}`); return 1 }

  let projects
  try { projects = await loadRegistry(io.registryFile || registryPath()) } catch (error) {
    err(`devkit: ${error.message}`)
    return 1
  }

  const server = http.createServer((req, res) => {
    handle(req, res, { projects }).catch(() => {
      if (!res.headersSent) send(req, res, 500, 'text/plain; charset=utf-8', 'error\n')
      else res.destroy()
    })
  })
  let attempts = 0
  let port = parsed.pinned === null ? 10000 + Math.floor(Math.random() * 10000) : parsed.pinned

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempts < 10) {
      attempts++
      port = parsed.pinned === null ? 10000 + Math.floor(Math.random() * 10000) : parsed.pinned + attempts
      if (port <= 65535) return server.listen(port, '127.0.0.1')
    }
    err(`devkit: ${error.message}`)
    process.exitCode = 1
  })
  server.on('listening', () => {
    out(`dev-kit dashboard: ${projects.length} project${projects.length === 1 ? '' : 's'}`)
    out(`  http://127.0.0.1:${server.address().port}/`)
    out('  read-only; Ctrl-C to stop.')
  })
  server.listen(port, '127.0.0.1')
  return 0
}

module.exports = { cmdDashboard, handle }

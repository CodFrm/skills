'use strict'

// en/zh chrome strings and lang/theme resolution for the dashboard.
//
// The boundary is decision 14 of the spec: only dashboard-generated chrome is localised — page
// titles, section headers, empty states, the 404 page, disconnected/unparseable wording and the
// toggle control itself. Plan data values, status badges and YAML field names are machine
// vocabulary and stay verbatim in either language.

const LANGS = ['en', 'zh']
const THEMES = ['light', 'dark']

// ?lang wins; otherwise the Accept-Language header; neither names zh or en, zh is the fallback.
// A query value outside the vocabulary is treated as absent.
function resolveLang(acceptLanguage, queryLang) {
  if (queryLang === 'zh' || queryLang === 'en') return queryLang
  const header = String(acceptLanguage || '').toLowerCase()
  let zh = null
  let en = null
  for (const part of header.split(',')) {
    const [tagRaw, ...params] = part.trim().split(';')
    const tag = tagRaw.trim()
    if (!tag) continue
    let q = 1
    for (const param of params) {
      const match = /^q=([\d.]+)/.exec(param.trim())
      if (match) q = Number(match[1])
    }
    if (q <= 0) continue
    if (tag === '*' || tag.startsWith('zh')) { if (zh === null) zh = q }
    else if (tag.startsWith('en')) { if (en === null) en = q }
  }
  if (zh === null && en === null) return 'zh'
  return (zh || 0) >= (en || 0) ? 'zh' : 'en'
}

// Only an explicit light/dark pins a theme; anything else (including absence) means "follow the
// system", which the client resolves through the prefers-color-scheme media query.
function resolveTheme(queryTheme) {
  return THEMES.includes(queryTheme) ? queryTheme : null
}

const STRINGS = {
  en: {
    dashboard: 'dev-kit dashboard',
    noProjects: 'No registered projects',
    addFirstProject: 'Use <code>devkit project add &lt;path&gt;</code> to add the first project',
    projectsSummary: (projects, running, disconnected) => `${projects} projects · ${running} running · ${disconnected} disconnected`,
    readyTasksEntry: (n) => `→ Ready tasks (${n})`,
    disconnected: 'disconnected',
    unableToParse: (n) => `unable to parse ${n}`,
    unableToParseLabel: 'unable to parse',
    readyTasks: 'Ready tasks',
    readyCount: (n) => `Ready — ${n}`,
    noReadyTasks: 'No ready tasks',
    taskWord: (id) => `task ${id}`,
    depsWord: (deps) => `deps: ${deps}`,
    backToProjects: '← Back to projects',
    disconnectedNote: (plans) => `This registered project is disconnected: its root or ${plans} directory does not exist.`,
    unableToParseGroup: 'Unable to parse',
    noPlans: 'No plans',
    projectsWord: 'projects',
    goalSection: 'Goal',
    contextSection: 'Context',
    tasksSection: 'Tasks',
    reviewSection: 'Review',
    verificationSection: 'Verification',
    notFound: 'not found',
    truncatedNote: (n, m) => `Showing the first ${n} of ${m} entries — the rest are not listed. Directories like node_modules and dist are skipped entirely.`,
    langZh: '中文',
    langEn: 'EN',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
  },
  zh: {
    dashboard: 'dev-kit dashboard',
    noProjects: '还没有注册任何项目',
    addFirstProject: '用 <code>devkit project add &lt;path&gt;</code> 添加第一个项目',
    projectsSummary: (projects, running, disconnected) => `${projects} 个项目 · ${running} 个进行中 · ${disconnected} 个失联`,
    readyTasksEntry: (n) => `→ 当前可跑任务（${n}）`,
    disconnected: '失联',
    unableToParse: (n) => `无法解析 ${n}`,
    unableToParseLabel: '无法解析',
    readyTasks: '当前可跑任务',
    readyCount: (n) => `可跑 — ${n}`,
    noReadyTasks: '没有可跑任务',
    taskWord: (id) => `任务 ${id}`,
    depsWord: (deps) => `依赖: ${deps}`,
    backToProjects: '← 回项目列表',
    disconnectedNote: (plans) => `该注册项目已失联：其根目录或 ${plans} 目录不存在。`,
    unableToParseGroup: '无法解析',
    noPlans: '暂无 plan',
    projectsWord: '项目',
    goalSection: '目标',
    contextSection: '背景',
    tasksSection: '任务',
    reviewSection: '审查',
    verificationSection: '验证',
    notFound: '未找到',
    truncatedNote: (n, m) => `仅显示前 ${n} 个（共 ${m} 个）——其余未列出。node_modules、dist 等目录被整体跳过。`,
    langZh: '中文',
    langEn: 'EN',
    themeSystem: '系统',
    themeLight: '浅色',
    themeDark: '深色',
  },
}

module.exports = { LANGS, THEMES, STRINGS, resolveLang, resolveTheme }

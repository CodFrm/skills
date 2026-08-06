# devkit dashboard：多项目只读 server，取代 serve

> Status: Draft
> Owner: dev-kit
> Last updated: 2026-08-06

**Objective:** 一个绑定本机的多项目只读 web server：聚合注册项目的 plan 状态、跨项目列出当前可跑任务、并原样承接 `serve` 的 specs/artifacts 静态浏览与 mockup 预览。`devkit serve` 随之移除。

**Hard invariant:** CLI 保持零运行时依赖；`node --test dev-kit/tests/*.test.js` 全绿；dashboard 对浏览器面只读（GET/HEAD）、绑定 `127.0.0.1`、拒绝非本机 Host；dashboard 自渲染的每一页都不携带可执行脚本（CSP_PAGE），specs/artifacts 下的用户 HTML（mockup）用 CSP_FILE；一切路径解析经过 realpath 边界（`resolveInside`），worktree 软链接场景不例外；既有 plan 文件与 `.dev-kit/plans/` 布局零改动，`plan` 命令面不变；自渲染文案支持 en/zh 且 plan 数据值永不翻译；深浅主题可切换，默认跟随系统偏好。

## Problem

1. **多项目并行没有聚合面。** 用户同时推进多个项目/多个 round（本次需求本身；本仓库 `.dev-kit/plans/` 现有 5 份 plan、1 份 `running`），要看"各项目现在在干什么"只能逐个 cd 进项目跑单项目命令（`lib/project.js:24-32` 的 `findRoot` 从 cwd 向上找根），每项目一次；不存在跨项目的只读概览。

2. **`serve` 的能力边界与需求不匹配，且它与 plan 概览互不互通。** `lib/project.js:14-20` 把 `.dev-kit/plans` 刻意排除在 serve 的浏览器白名单之外（"a working plan is not for that"），`tests/project.test.js:78` 断言锁死；serve 一次只服务 cwd 所在项目。要分项目看 plan、看进行中任务、预览 mockup，必须新建入口；新建与 serve 并存就是两个 server、两套安全契约、两处文档。

3. **plan 是 gitignore 的执行状态，进浏览器面自带安全含义。** plan 落在 `.dev-kit/plans/`，worktree 里 `.dev-kit` 是软链接回主仓库（`lib/project.js:14-20` 注释）。serve 的 CSP_FILE 是为 mockup 放的——用户 HTML 可以跑脚本（`lib/serve.js` 的 `CSP_FILE`）。plan 概览一旦与 mockup 预览进同一个 server，必须按响应区分 CSP，否则 plan 数据页会拿到可执行文档身份。

## Actors and user stories

1. 作为**同时在多个项目推进**的用户，我想用一个 URL 看到各项目现在在跑什么、各 plan 卡在哪、所有项目里哪些任务当前可跑，这样不用逐个 cd 进项目跑 CLI。
2. 作为**做 UI mockup** 的用户，我想在 dashboard 里就能预览 mockup 静态 bundle，这样不用再记 `serve` 这个命令。
3. 作为**维护 dev-kit** 的开发者，我想砍掉 `serve` 及其测试和文档引用，这样命令面只有一个 dashboard、一份安全契约。
4. 作为**用中文或英文**的开发者，我想 dashboard 的界面文案与配色用我选的语言和主题，这样不用读机器词汇、也不用改系统设置；我的选择在 URL 上、可分享、无状态。

## Design decisions

| # | Decision | Basis and rejected option |
|---|---|---|
| 1 | 新增 `dashboard` 命令，移除 `serve`，其能力并入 dashboard | 用户选定（2026-08-06）。Rejected：保留 serve —— 两个 server 两种心智、两套文档；Rejected：只加 dashboard 不砍 serve —— 违背"单一 server"诉求 |
| 2 | 注册表放用户级 `~/.config/devkit/projects.json`（尊重 `XDG_CONFIG_HOME`） | dashboard 必须独立于 cwd 枚举项目，项目内注册表没有入口。Rejected：项目内 `.dev-kit/projects.json` —— 找不到入口；Rejected：shell rc 散列 —— 不是结构化数据 |
| 3 | 条目 `{ name, root }`；root 存 realpath；name 缺省 `basename(root)`，可 `--name` 覆盖 | add 时校验是目录且含 `.git` 或 `.dev-kit`；root 或 name 重复 → 失败。Rejected：存相对路径 —— 换目录就漂移 |
| 4 | `project add / list / remove`；`remove` 只删注册表条目，不碰项目文件 | 用户选定。Rejected：不做 remove —— 注册表没法纠错 |
| 5 | 全站 GET/HEAD 只读 + 绑 `127.0.0.1` + Host 校验 + 其余 405 | 沿用 serve 的安全姿势（`lib/serve.js`）。Rejected：允许写 —— dashboard 不是编辑器，写路径 CLI 与 skill 流程已有 |
| 6 | CSP 按响应区分：自渲染页一律 CSP_PAGE；specs/artifacts 下的 `.html` 用 CSP_FILE | 沿用 serve 的 `cspFor`。mockup 必须能跑内联脚本（`file://` 挡 ES module import，`mockups.md:14`），plan 页必须不能。Rejected：全站 CSP_FILE —— plan 页成为可执行文档；Rejected：全站 CSP_PAGE —— mockup 预览废掉 |
| 7 | 路径解析全部过 `resolveInside`：URL 项目名 → 注册表查 root → 在 specs/artifacts/plans 三面内 realpath 解析 | worktree 软链接的 realpath 不在 worktree 下；`lib/plan.js` 已证明以 plans 目录为 root 传 `resolveInside` 的做法。Rejected：字符串前缀/`..` 剥离 —— 可被归一化绕过 |
| 8 | plan 渲染复用 `lib/plan.js` 的 reader（`parsePlan`/`checkPlan`/`VOCAB`/`KEYS`，`plan.js:840` 已导出） | 零依赖下不重写解析器。Rejected：手写渲染 —— 解析逻辑两份 |
| 9 | 单份坏 plan 只影响自身页面，渲染解析错误页；注册表 JSON 损坏则启动失败 | plan 是执行中状态，`parsePlan` 会抛 `PlanError`；注册表是手编 JSON，语法错应快速显形而不是被掩盖。Rejected：坏 plan 让整个项目页 500；Rejected：注册表坏只显示 banner |
| 10 | 首页提供跨项目统一"当前可跑任务"视图（`/tasks`） | 用户选定（2026-08-06）。Rejected：仅项目卡片 —— 用户明确要聚合"正在进行的任务" |
| 11 | 不自动刷新、不提供 `--json` | 扩展点，无当前需求。Rejected：meta refresh / JSON API |
| 12 | 注册表写入走同目录临时文件加 rename | 进程中途中断不留半份 JSON。Rejected：原地覆写 |
| 13 | 语言用 `?lang=en\|zh` 选择，默认按 `Accept-Language` 头匹配，都不匹配回退 zh；主题用 `?theme=light\|dark`，默认跟随 `prefers-color-scheme`；所有内部链接携带当前值，切换是链接不是 JS | 只读、零 JS、不写 cookie 的静态页只能让状态住在 URL 里——可分享、无状态。Rejected：cookie —— 让 GET/HEAD 响应带上状态写入语义；Rejected：JS 读偏好写 DOM —— 违反零 JS；Rejected：路径前缀 `/zh/` —— 配 cookie 才持久，更重 |
| 14 | 只本地化 dashboard 生成的 chrome 文案；plan 数据值（status/task status/review/verification 的值、mode、worktree、spec 路径、goal/context/note 文本）一律原样显示不翻译，状态徽章显示机器值 | 这些值是与 CLI 和 skill 共享的机器词汇，翻译产生第二套词汇；数据是 agent 写的，dashboard 不重写。用户选定（2026-08-06）。Rejected：状态徽章本地化 —— 徽章显示本地化标签会让同一状态有两套叫法，且与 CLI 输出不一致 |
| 15 | 深浅主题默认由 `prefers-color-scheme` 媒体查询决定；显式 `?theme=` 时用 `<html data-theme>` + 内联 CSS 覆盖钉死 | 服务端拿不到客户端主题偏好，零 JS 下只能媒体查询默认 + data-theme 覆盖（CSP 允许 inline style）。Rejected：服务端检测 UA/时区 |
| 16 | lang 与 theme 独立正交，任意组合，无参数即默认值 | 一个参数不该影响另一个。Rejected：绑定成单一预设 |

## 命令面

**`devkit dashboard [--port <n>]`**：启动只读 server。注册表不存在或为空 → 正常启动，首页显示空态与 `devkit project add` 提示。注册表存在但 JSON 解析失败 → 启动失败，报文件路径与解析错误。端口占用 → 沿用 serve 的随机端口重试（`lib/serve.js` 的 `pick` 逻辑）。

**`devkit project add <path> [--name <name>]`**：`path` 解析为绝对路径；必须是目录且含 `.git` 或 `.dev-kit`，否则失败退出并说明；`name` 缺省 `basename`；root 已注册或 name 已占用 → 失败；注册表文件不存在则创建（含父目录），写入走临时文件加 rename。

**`devkit project list`**：逐行输出 `name  root`。

**`devkit project remove <name>`**：删除条目；找不到 → 失败；不触碰项目文件。

**`devkit serve`** 从命令面与帮助文本移除；`lib/serve.js`、`tests/serve.test.js` 删除；`lib/project.js` 移除 `ROOTS`（保留 `PLANS`、`SKIP_DIRS`、`findRoot`、`resolveInside`）。

## 页面

**`/`（首页）**：项目卡片列表 + `/tasks` 入口。卡片含 name、root、各 status 的 plan 计数、失联标记（root 不存在或 `.dev-kit/plans` 缺失）、"无法解析"计数。

**`/tasks`（统一可跑任务视图）**：跨项目所有 ready 任务平铺，每项含项目 name、plan slug、任务 id、goal、deps；空态提示"没有可跑任务"。ready 定义沿用 `executing-plans/SKILL.md:49`：`status: todo` 且 `deps` 全部 `done`。

**`/projects/<name>/`（项目页）**：plan 按 status 分组（running → ready → draft → stopped → done → 无法解析），每行含 slug、status、goal（截断）、任务进度 `done/total`；附 specs/artifacts 浏览入口。

**`/projects/<name>/plans/<slug>`（plan 页）**：完整渲染 `status/mode/worktree/goal/context/tasks(id/status/goal/deps/commit/note)/review/verification`；`spec` 字段显示为文字路径（不内联渲染文件）；`parsePlan` 失败 → 错误页显示 `PlanError` 的 message 与 line。

**`/projects/<name>/specs/...`、`/projects/<name>/artifacts/...`**：目录浏览与文件服务，沿用 serve 的 index.html 优先、`SKIP_DIRS`、`MAX_ENTRIES` 截断与 `../` 链接。

### 视觉契约（由 mockup 决定，见 Links）

- 基础样式沿用 `lib/serve.js` 的 `page()` 外观：`ui-monospace`、`max-width:52rem`、深浅色跟随 `prefers-color-scheme`。
- 首页项目卡片：`auto-fill minmax(18rem,1fr)` 网格；卡片含 name（链接）、root（dim、单行省略）、status 计数徽章行；失联项目用琥珀虚线边框加「失联」徽章。
- status 徽章颜色：running 绿、ready 蓝、draft 灰、stopped 琥珀、done 淡灰半透明、无法解析红；首页副标题给汇总（项目数 / 进行中 / 失联）。
- plan 行：status 徽章 + slug（链接）+ goal（单行 ellipsis）+ 进度 `done/total`（dim）；按 status 分组，组标题小号大写，顺序 running → ready → draft → stopped → done → 无法解析。
- plan 详情：顶部 meta 行（status/mode/worktree 徽章），随后 spec/review/verification 键值，再 Goal/Context/Tasks/Review/Verification 分节；Tasks 用表格（id / status / goal / deps / commit / note）。
- `/tasks` 行：ready 徽章 + 项目名 + plan slug + 任务 id + goal；空态文案「没有可跑任务」。
- 空注册表：虚线框提示 `devkit project add <path>`；坏 plan：琥珀 note 行显示 `PlanError` 的 message 与 line。
- 每页头部右上角渲染语言（中文/EN）与主题（系统/浅色/深色）切换链接，右对齐、小号、dim；当前值以无下划线文本标记，另两个是链接。

## i18n 与主题

- 每页 `<html>` 渲染 `lang` 属性（`zh-CN`/`en`）与（显式选择时）`data-theme`；文案从 en/zh 两套静态表取，覆盖的键包括页面标题、分节标题（Goal/Context/Tasks/Review/Verification 及中文对应）、status 计数措辞、空态、404、失联与无法解析文案、切换控件自身。
- 语言：`?lang=en|zh` 优先；否则按 `Accept-Language` 头匹配；都不匹配回退 zh；非法 `lang` 值按未提供处理。
- 主题：`?theme=light|dark` 优先；否则不设 `data-theme`，由 `prefers-color-scheme` 媒体查询决定；非法值按未提供处理。
- 每个页面的内部链接（项目、plan、目录、`../`、specs/artifacts、`/tasks`、首页）都携带当前 `lang`/`theme` 值；切换链接改其一、保留另一。
- 不翻译：plan 数据值（status/task status/review/verification 的值、mode、worktree、spec 路径、goal/context/note 文本）、spec/artifact 文件名与内容、注册表路径、`PlanError` 原文。
- 两种主题下文本与背景对比度一致；goal 单行省略对中文同样生效，不做按语言的截断差异。

## 安全

- 绑 `127.0.0.1`；Host 校验（本机名 + 端口核对）；GET/HEAD 只读，其余 405。
- `cspFor` 按响应：自渲染页（首页/任务页/项目页/plan 页/目录列表/404）CSP_PAGE；specs/artifacts 下 `.html` 文件 CSP_FILE。
- 一切来自 URL 或文件名的字符串渲染时转义，链接按段 `encodeURIComponent`。
- 路径解析：URL 首段（`/tasks` 或 `/projects/<name>/<面>/<余下>`）→ 项目名查注册表（未知 → 404）→ 在该 root 的 specs/artifacts/plans 三面内 `resolveInside`。plan 面以该项目的 plans 目录为 root（与 `plan` CLI 一致），specs/artifacts 面以项目 root 下对应目录为 root。
- 注册表是用户本机文件；server 不自行发现注册表之外的目录，不跟随任何来自 URL 的绝对或上级路径。
- 页面零 JS 依赖：用语义化列表与链接（沿用 serve 的 `page()`/`renderDir` 标记），不引入任何内联脚本或依赖外链。

## 失败与恢复

- 项目 root 被删/改名 → 首页卡片标记"失联"，进入项目页 404。
- 单份 plan 解析失败 → 首页/项目页计数与标记"无法解析"，plan 页错误页；不影响其它 plan 与其它项目。
- 注册表 JSON 损坏 → 启动失败并指出路径。
- 端口占用 → 随机重试。

## 兼容

- `serve` 的文档引用移除：`dev-kit/README.md:79` 与 `brainstorming/references/mockups.md:14,18` 改为 `devkit dashboard`；mockup 引导保留"`file://` 挡 ES module import → 用 dashboard 预览"的退路说明。
- 既有 plan 文件与 `.dev-kit/plans/` 布局零改动；`plan` 命令面不变。
- 本 spec 反转 `2026-08-03-devkit-plan-cli.md` 的两条 Out of scope（"把 plan 暴露给 serve"、"跨项目操作"）与 hard invariant（"serve 暴露给浏览器的路径集合不变"）——serve 不复存在，那条不再适用。

## Out of scope

- 写操作：改 plan 状态、增删项目走 CLI 与 skill 流程，dashboard 只读。
- 自动刷新、`--json`、认证/多用户、TLS。
- plan 页内联渲染 spec 文件内容。
- 把 dashboard 做成守护进程、系统服务或插件。

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| `handle()` 进程内驱动 | URL 路由（`/`、`/tasks`、`/projects/<name>/…`）、项目名未知 404、CSP 按响应区分、specs/artifacts/plans 三面穿越、坏 plan 错误页、失联项目 | `tests/serve.test.js` 的 mkdtemp + `handle` 模式 |
| registry 纯函数 | add 校验（非目录、无 `.git`/`.dev-kit`）、name/root 冲突、list、remove、文件缺失创建、JSON 损坏报错、原子写入 | `tests/project.test.js` 直接测 `lib/` |
| 真实进程端到端 | dashboard 启动端口、首页内容、`project add` 后首页出现项目 | `tests/serve.test.js` 真实进程先例 |
| 移除面 | `bin/devkit` 帮助不再有 serve；`lib/serve.js` 与 `tests/serve.test.js` 不存在；`project.js` 无 `ROOTS` | `tests/manifests.test.js` 式静态断言 |
| i18n 文案表 | en/zh 两套键一一对应、无缺键、无占位符漂移 | 静态断言（`manifests.test.js` 式） |
| lang/theme 渲染 | `?lang`/`?theme` 对每页的 `lang`/`data-theme` 属性与文案生效；非法值回退；内部链接携带参数；切换保另一参数 | `handle()` 进程内驱动 |
| 主题对比度 | 两套 palette 下文本与背景对比度达标 | 静态断言 |
| 不能自动化 | mockup 在真实浏览器里能否打开（ES module 行为、CSP_FILE 放行内联脚本） | 静态审查覆盖 |

## Links

- `dev-kit/lib/plan.js`、`dev-kit/lib/project.js` — 复用的 reader 与路径边界；`dev-kit/lib/serve.js` — 被吸收的实现
- `dev-kit/skills/brainstorming/references/mockups.md`、`dev-kit/README.md` — mockup 引导与命令面文档
- `docs/specs/2026-08-03-devkit-plan-cli.md` — 被本 spec 反转的 Out of scope 与 hard invariant
- mockup（本地，不进 Git）：`.dev-kit/artifacts/2026-08-06-devkit-dashboard/mockups/gallery.html`（+ `README.md`）— 决定「视觉契约」一节的布局/密度/层级/状态，仅作佐证，不承载绑定决定

## Open questions

（无）

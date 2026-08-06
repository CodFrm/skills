# dashboard 阅读面 + dev-kit 工程化

> Status: Draft
> Owner: dev-kit
> Last updated: 2026-08-06

**Objective:** 项目卡片整块可点击跳转项目页；dashboard 把 markdown 内容——`specs/` 下的 `.md` 文件与 plan 详情页的散文字段——渲染成可读 HTML；并给 dev-kit 补开发期工具链（lint + 类型检查，只加 `devDependencies`，运行时零依赖不变）。

**Hard invariant:** CLI 运行时保持零依赖（`dev-kit/package.json` 只允许新增 `devDependencies`，不允许 `dependencies`；`bin/devkit:6` 的"Zero dependencies"边界不变，分发仍是拷贝即用）；一切渲染先转义后格式化，源 `.md` 永不作为可执行文档（渲染页用 CSP_PAGE）；既有安全姿势与 `?lang`/`?theme` 机制不变；`node --test dev-kit/tests/*.test.js` 全绿。

## Problem

1. **项目卡片只有项目名可点。** `lib/dashboard.js` renderHome 生成 `<div class="card"><h2><a href=…>name</a></h2>…`，link 只包住 name；卡片主体（root、status 徽章行）点击无反馈——大面积可感知区域浪费，跳转入口太小。

2. **阅读面不渲染 markdown。** `lib/dashboard.js` 的 `TYPES` 把 `.md` 映射为 `text/plain`（实测 `content-type: text/plain`），浏览器直接看到 `#`、`**`、`<br>` 标记；plan 详情页的 goal/context/note 也是转义纯文本。dashboard 是给人看的，spec 与 plan 散文不渲染就成了半成品。

## Actors and user stories

1. 作为**浏览 dashboard 的用户**，我想点卡片任意位置就进项目页，这样不用瞄准那个小链接。
2. 作为**读 spec / plan 的用户**，我想看到渲染后的标题、列表、表格、代码块，而不是原始标记文本。
3. 作为**维护 dev-kit 的开发者**，我想有 lint 与类型检查跑在开发期，这样手写解析器/渲染器/服务器不靠肉眼找低级错误。

## Design decisions

| # | Decision | Basis and rejected option |
|---|---|---|
| 1 | 整卡用单个 `<a class="card" href=…>` 包裹（h2 文字/root/徽章均纯文本、卡片内无其它链接），保留原生链接语义（可聚焦、键盘可达） | 卡片内没有其它可点元素，包裹式最简单且无障碍。Rejected：stretch-link —— 要额外 CSS 定位，且这里没有内链需要保留 |
| 2 | 手写零依赖 markdown→HTML 渲染器 `lib/markdown.js`，支持子集：ATX 标题 `#`–`#####`、段落、无序/有序列表、粗体/斜体/行内代码、围栏代码块（```）、引用 `>`、链接 `[t](u)`、管道表格 | 零依赖硬约束下不能引 markdown-it；spec 模板大量用表格（`docs/specs/2026-08-03-devkit-plan-cli.md` 的决策表），管道表格必须支持。Rejected：引 `markdown-it` —— 违反零依赖；Rejected：完整 GFM / 脚注 / 任务列表复选框 / HTML 透传 —— 范围过大，且 HTML 透传直接开 XSS 面 |
| 3 | `specs/` 下的 `.md` 渲染成 HTML 页（延续 dashboard `page()` 样式，带 `lang`/`theme`/toggle），`?raw=1` 看原文 `text/plain` | 浏览 .md 的默认形态是阅读；raw 供精确读原文/调试。Rejected：不提供 raw —— 原文本就丢在 repo，但浏览器里要有出口 |
| 4 | plan 详情页的散文字段（`goal`、`context` 每条、task 的 `goal`/`note`、review/verification 的 `note`）用同一渲染器；字段键、`status`/`mode`/`worktree`/`spec` 路径、id/commit 等机器值保持不渲染 | 散文是给人读的，机器值是词汇表，渲染只作用于前者。Rejected：全部字段都渲染 —— 机器值变成 HTML 无意义且易错 |
| 5 | 渲染器先对原始文本**整体转义**再按标记格式化；转义后的文本是唯一被插值进 HTML 的内容；坏输入（如未闭合表格）降级为转义原文，不 500 | 转义后才格式化，源 `.md` 的任何 `<script>` 都只是文本。Rejected：在未转义文本上正则替换 —— XSS |
| 6 | 工程化只加 `devDependencies`（eslint + typescript `--checkJs`），运行时 `dependencies` 保持为空 | 分发模型是拷贝目录，运行时依赖会打破"拷贝即用"；开发期工具是作者本地的事。Rejected：Vite/esbuild 构建 + 运行时依赖 —— 见问题讨论，违反硬约束且改分发 |
| 7 | 类型检查用宽松 `tsconfig`（`checkJs`+`allowJs`+`noEmit`，不开 `noImplicitAny`），lint 用 eslint flat config 最小规则集 | 现有代码全是无 JSDoc 的 JS，开严格会逼出一轮大规模标注迁移，超出本轮。Rejected：`strict: true` + 全量 JSDoc —— 迁移量大；Rejected：只检查新文件 —— 不抓住存量错误 |
| 8 | `npm run lint` / `npm run typecheck` / `npm test` 三个脚本，整套（测试 + lint + typecheck）必须绿 | 工具链要有唯一的入口与闸门。Rejected：不设脚本 —— 命令散落没法当闸门用 |

## 行为

- **卡片**：首页每个项目卡片是单个 `<a class="card" href="/projects/<name>/…">`，点击整卡跳转；`:hover`/`:focus` 沿用链接样式；卡片内不嵌套链接。
- **specs .md 渲染**：`GET /projects/<name>/specs/<file>.md`（无 `?raw`）→ `200 text/html` 渲染页（CSP_PAGE、带 toggle、标题为文件名，正文为渲染后的 markdown）；`?raw=1` → `200 text/plain` 原文。目录列表里 `.md` 链接指向渲染页（带当前 `lang`/`theme` 参数）。
- **plan 散文渲染**：plan 详情页的 goal 分节、context 列表项、task 行内 goal/note、review/verification note 渲染；这些字段渲染失败降级为转义原文。表格/任务表格（机器渲染的那个 `Tasks` 表格）不受影响。
- **安全**：渲染页一律 CSP_PAGE；`.md` 不再以 `text/plain` 外的身份存在，原始内容永远只在 `?raw=1` 下以文本返回。
- **工程化**：`dev-kit/package.json` 加 `devDependencies`（eslint、typescript），新增 `eslint.config.js` 与宽松 `tsconfig.json`；`bin/`、`lib/`、`tests/`、`skills/` 下的 `.js` 过 lint 与 `tsc --noEmit --checkJs`；`npm run lint` / `npm run typecheck` / `npm test`（等价 `node --test dev-kit/tests/*.test.js`）全绿；运行时文件不因工具链改变行为。

## Out of scope

- artifacts/ 下非 markdown 文件的渲染、markdown 编辑器、写回。
- 完整 GFM、脚注、任务列表复选框、HTML 透传。
- 修改任何既有 `.md` 文件。

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| `lib/markdown.js` 纯函数 | 每种标记的渲染输出、先转义防 XSS（`<script>` 只成文本）、坏输入降级、表格/代码块/引用 | `dev-kit/tests/project.test.js` 直接测 `lib/` |
| `handle()` 进程内 | `.md` → `text/html` + CSP_PAGE；`?raw=1` → `text/plain`；卡片 `<a class="card" href=…>`；plan 散文渲染而字段键/机器值不渲染；lang/theme 参数在 .md 渲染页与列表链接上保留 | `dev-kit/tests/dashboard.test.js` |
| 既有回归 | 默认 `Accept-Language: en` 下原 dashboard 测试全绿；`.md` 的 `?raw=1` 与旧 `text/plain` 行为等价 | 现有全套 |
| 工具链 | `npm run lint`、`npm run typecheck` 对 `bin/`、`lib/`、`tests/` 下的 `.js` 退出 0；`npm test` 与 `node --test dev-kit/tests/*.test.js` 等价 | 无（新增） |

## Links

- `docs/specs/2026-08-06-devkit-dashboard.md` — 被本 spec 扩展的阅读面；`lib/dashboard.js` 的 `TYPES`/renderHome/renderPlan
- mockup 画廊（本地）：`.dev-kit/artifacts/2026-08-06-devkit-dashboard/mockups/gallery.html` —— 卡片/页式基准

## Open questions

（无）

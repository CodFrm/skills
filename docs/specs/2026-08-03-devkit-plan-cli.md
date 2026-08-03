# devkit plan：主会话编辑 plan 的语法糖

> Status: Approved
> Owner: dev-kit
> Last updated: 2026-08-03

**Objective:** 给可选 CLI 加一组认识 plan 状态机的 `plan` 子命令，让主会话不必读整份 YAML、也不必靠上下文凑唯一匹配，就能读出下一个可执行任务并改动执行期状态。

**Hard invariant:** `devkit serve` 暴露给浏览器的路径集合不变——plan 是 gitignore 的工作状态，不进浏览器可达面；CLI 保持零运行时依赖；`node --test dev-kit/tests/*.test.js` 全绿；仓库里两份已偏离模板的 plan 不经修改就能被写命令操作。

## Problem

1. **改一个任务状态要在几十处同名行里凑唯一匹配。** `.dev-kit/plans/2026-08-01-dev-kit-evals.yaml` 有 493 行、33 处 `status:`。用 Edit 改其中一处，`old_string` 必须带足周边行才能唯一；带的那几行还得先读进上下文。一次状态跃迁的成本因此和 plan 的长度成正比，而 `executing-plans` 的循环每个任务至少跃迁三次（`doing` → `reviewing` → `done`）。

2. **手改已经让 plan 偏离约定 schema，而且整轮没人发现。** `writing-plans/SKILL.md:49-57` 定的是 `review.status: pending | passed | stopped`、`review.fixes: []`、`verification.status: pending | running | reported | accepted | blocked`。实际两份 plan：
   - `2026-08-01-dev-kit-evals.yaml:465` 是 `review.status: findings`（不在词汇表），`:466` 多出 `wrapup_spec:`，`:474` 多出 `status_note:`，`:453` 多出顶层 `delivery_caveats:`；
   - `2026-07-31-pi-subagent-integration.yaml:95` 是 `review.status: done`（不在词汇表），`:96` 是 `review.fix:`（单数，模板是 `fixes`），`:99` 是 `verification.status: passed`（词汇表里是 `accepted`）。

   这些不是笔误就是即兴扩展，两者都没有任何东西会报出来。**代价是恢复语义**：`executing-plans/SKILL.md:20-28` 的恢复表按 `verification.status` 的值分支，`passed` 不在它认识的五个值里，恢复时落不进任何一条分支。

3. **挑下一个可执行任务只能人肉算 deps。** `executing-plans/SKILL.md:49` 定义 ready 为「`status: todo` 且所有 `deps` 已 `done`」，而 `writing-plans/SKILL.md:70` 明确「列表顺序没有意义」——顺序不可依赖，就只能把整张任务表读进上下文再算一遍闭包。这件事完全机械，却每轮循环重复一次。

4. **并行闸门的四条边界没有任何机械检查。** `executing-plans/SKILL.md:55-64` 要求每次并行派发前追加一条 `parallel_evidence`，逐条写明 writes、dependencies、resources、verification 四个边界与精确 HEAD。这四条目前只由散文约束，漏写一条不会被任何东西挡住。（弱证据：文档陈述与代码库中不存在相关检查，不是观察到的故障。）

## Actors and user stories

1. 作为**在 `executing-plans` 循环里推进的主会话**，我想用一条命令问出哪些任务现在可跑、用一条命令写回状态跃迁，这样每轮循环的上下文开销与 plan 长度无关。
2. 作为**接手一份陌生 plan 的主会话**，我想先跑一次校验就知道它有没有偏离约定 schema、`deps` 有没有指向不存在的任务，这样恢复时不会撞进认不出的状态值。
3. 作为**只装了 skill 正文、没有 CLI 的使用者**，我想 `executing-plans` 在没有 `devkit` 时照样能走完，这样这组命令是加速而不是新增的必需品。

## Design decisions

| # | Decision | Why（以及被否掉的） |
|---|---|---|
| 1 | 命令按 plan 概念暴露并校验状态词汇，而非做通用 key/value 编辑器 | 用户选定。Rejected：薄 `set <path> <value>`——不挡 `status=dong`、不挡改冻结字段，省下的只有 Edit 的上下文，问题 2 一分不减；Rejected：只加读命令与校验、写仍走 Edit——问题 1 原样保留 |
| 2 | 写入是**行级定位替换**，不做 YAML round-trip | `dev-kit/package.json` 无 `dependencies`，`bin/devkit:6` 把零依赖写成边界，标准库没有 YAML parser。任何 round-trip 实现都会重排 493 行并把 `goal: >-` 这类折叠标量改写成别的形式，而 plan 是 agent 每轮都要读的文件。Rejected：引入 YAML 库；Rejected：手搓 dumper——重排问题一样 |
| 3 | 写命令只校验自己要写的那个字段，文件别处的未知键与未知值一律不管 | 用户选定。Rejected：写前全量校验、不过就拒——本仓一份正在 `running` 的 plan 会被可选工具卡住；Rejected：全量校验后仅警告——重复警告会被无视，等价于本方案但每次多烧 token |
| 4 | plan 目录用独立常量，不加进 `ROOTS` | `lib/project.js:14-17` 的 `ROOTS` 是 `serve` 的浏览器白名单。把 plan 加进去，gitignore 的工作状态就能从 `http://127.0.0.1:<port>/` 读到，而这不是任何需求要的。Rejected：复用 `ROOTS` 省一个常量 |
| 5 | 冻结字段（task 的 `goal`/`deps`/`files`/`model`/`interfaces`，以及 plan 的 `spec`/`worktree`/`goal`）没有任何写入路径，连 flag 都不提供 | `writing-plans/SKILL.md:96` 规定 recut 要重跑完整闸门，其产物是按新 breakdown 重写整份 plan，不是戳一个字段。Rejected：`--force`——它开出一条不经用户闸门就改冻结字段的路，正好削掉本次要立的护栏 |
| 6 | `executing-plans` 只加一句可选提示，不写成规定路径 | 用户选定。`dev-kit/README.md:56` 说明只装 skill 正文的人没有 `devkit`；先例是 `brainstorming/references/mockups.md:14`（提命令并给出 `node "<dev-kit root>/bin/devkit"` 的退路）。Rejected：规定必须走 CLI——skills-only 安装会断；Rejected：只改 README——主会话在循环里读不到，语法糖没人用 |
| 7 | 地址定位不唯一或找不到时失败退出，绝不猜 | 猜错的后果是静默写坏一份正在跑的 plan，而 plan 是 gitignore 的，没有 git 兜底。Rejected：取第一处匹配 |
| 8 | 写入走同目录临时文件加 rename | 进程中途中断不留半份 plan。Rejected：原地覆写 |
| 9 | 输出为紧凑文本，不提供 `--json` | 当前唯一消费者是读命令输出的 agent。Rejected：`--json`——没有需求要它，属于该删的扩展点 |
| 10 | 不加文件锁 | 单写者是 skill 规则（`executing-plans/SKILL.md:15`），CLI 层加锁保护不了违反规则的调用方，只增加失败模式。Rejected：锁文件 |
| 11 | 被寻址那一行的行尾注释保留，只换值 | 用户选定（2026-08-03，实现期）。本轮的出发点就是「手改 YAML 在悄悄改 schema」，一个默默删掉文本的工具是同一类问题；`writing-plans/SKILL.md:20-57` 的模板在四个可写 `status:` 行上都带状态图例，手写批注同理。Rejected：整行覆盖——两份真 plan 恰好没有注释，实际数据上触发不了，但这只说明代价低，不说明行为对 |
| 12 | 文件系统错误走与其它失败相同的干净退出路径 | 写入让它从罕见变常见（只读 plans 目录 → EACCES）。一个以未处理 rejection 加堆栈退出的 CLI，读起来像崩溃而不是拒绝。Rejected：留给调用方判断 |

## 选定 plan

**前提**：工作目录在项目内（向上找 `.git` 或 `.dev-kit`，沿用 `lib/project.js:24-32` 已有的判定）。

每条 `plan` 子命令都接受可选的 `--plan <slug>`。省略时：`.dev-kit/plans/` 下**恰好一份** `status` 不为 `done` 的 plan 就选它；有多份或一份都没有则失败退出，并列出可选的 slug。这对齐 `executing-plans/SKILL.md:11` 的入口——它要的就是一份 `ready` 或未 `done` 的 plan。

找不到项目根、没有 `.dev-kit/plans/` 目录、指定的 slug 不存在，三种情况都失败退出并各自说明是哪一种。

## 读命令

**`devkit plan next`** 输出所有 ready 任务的 id 与 goal。ready 的定义取自 `executing-plans/SKILL.md:49`：`status: todo` 且 `deps` 列出的每个 id 都已 `done`。没有 ready 任务时输出为空并成功退出——「现在没有可跑的」是正常状态，不是错误。若某个 `deps` 指向不存在的任务 id，失败退出并指出是哪一条。

**`devkit plan show`** 不带 `--task` 时输出 plan 的顶层状态摘要：`status`、`mode`、`worktree`、各任务的 id 与 status、`review.status`、`verification.status`。带 `--task <id>` 时输出该任务的全部字段。任务 id 不存在则失败退出。

**`devkit plan check`** 全量校验并区分两级：

- **错误**（失败退出）：状态字段的值不在其词汇表内；`deps` 指向不存在的任务 id；任务缺少 `id` 或 `status`；plan 缺少 `status` 或 `tasks`。
- **提示**（成功退出）：出现约定 schema 之外的键。本仓两份 plan 里的 `delivery_caveats`、`wrapup_spec`、`status_note` 都是有意加的，判红会让校验变成噪音。

两级都逐条打印，各自标明所在行。

## 写命令

写入集合等于 `writing-plans/SKILL.md:98` 允许在 ready 之后改动的字段：

| 命令 | 写入地址 | 合法值 |
|---|---|---|
| `devkit plan set status <v>` | plan 的 `status` | `draft` \| `ready` \| `running` \| `done` \| `stopped` |
| `devkit plan set mode <v>` | plan 的 `mode` | `subagent` \| `inline` |
| `devkit plan task <id> --status <v>` | 该任务的 `status` | `todo` \| `doing` \| `reviewing` \| `done` \| `blocked` |
| `devkit plan task <id> --commit <sha>` / `--note <text>` | 该任务的 `commit` / `note` | 自由文本 |
| `devkit plan review --status <v>` | `review.status` | `pending` \| `passed` \| `stopped` |
| `devkit plan review --fix <sha>` | 向 `review.fixes` 追加一个 SHA | 已有两条时失败 |
| `devkit plan verification --status <v>` | `verification.status` | `pending` \| `running` \| `reported` \| `accepted` \| `blocked` |
| `devkit plan verification --report <p>` / `--head <sha>` / `--note <t>` | 对应字段 | 自由文本 |
| `devkit plan context --add <text>` | 向 `context` 追加一条 | 自由文本 |

一条命令可同时给出同一对象上的多个 flag（例如 `task 3 --status reviewing --commit f5401dc`），它们要么全部写入、要么一个都不写。

`review.fixes` 按模板是一列 SHA（`writing-plans/SKILL.md:51` 的注释「up to two wrap-up fixer SHAs」），所以 `--fix` 只追加 SHA，没有随行的批次或备注 flag——审查发现的去处是任务的 `note`（`executing-plans/SKILL.md:98`）。已有两条时追加第三条失败退出：`executing-plans/SKILL.md:115` 把静态收尾的上限定为两次 fixer 派发，超出该走 `review.status: stopped` 而不是再修一次。

**`devkit plan evidence`** 向 `parallel_evidence` 追加一条，要求 `--tasks`、`--head`、`--source`、`--writes`、`--dependencies`、`--resources`、`--verification` 七项**全部**给出，缺任意一项失败退出并指出缺的是哪几项。这七项对应 `executing-plans/SKILL.md:55-64` 的闸门要求；本命令的价值就在于四条边界写不全就写不进去。

写入不做状态转换合法性判断——只校验值在词汇表内，不校验 `todo` 能不能直接跳到 `done`。转换顺序由 `executing-plans` 的流程决定，且恢复场景本就允许非常规跃迁。

## 文件保全

一次写入只改动被寻址的那一行上的**值**（追加类命令则只插入新行）。该行的键、左边距与行尾注释原样保留：`status: running   # draft → ready → …` 被写成 `done` 之后，注释仍在。文件其余每一个字节同样保持原样，包括缩进、空行、键的顺序，以及 `goal: >-` 这类折叠标量的原始换行位置。

值本身含 `#` 时不得被误判成注释起点——判定以被替换值的实际边界为准，不靠扫描字符。注释边界无法无歧义判定时失败退出，不写入。

因此写命令**不**会顺手修正问题 2 里那些偏离——`review.fix:` 保持单数，`verification.status: passed` 保持原值。发现它们是 `check` 的职责，修正它们是人的决定。

寻址失败即失败退出：目标键在被寻址的对象里找不到、或在同一对象里出现多次，都不写入。

落盘阶段的文件系统错误（权限、磁盘满、rename 失败）与上述失败同一条退出路径：一条说明性错误信息、退出码非零、不打印堆栈，plan 保持写入前的内容。

## 与 skills 的关系

`executing-plans/SKILL.md` 增加一句：有 `devkit` 时可用 `devkit plan next` 与 `devkit plan task` 一类命令读写 plan，没有时直接读写 YAML 文件。这句话不改变任何流程约束——单写者、闸门、状态词汇都由 skill 正文继续拥有，CLI 只是执行同一件事的更省的方式。

`dev-kit/README.md` 的「可选 CLI」一节补上 `plan` 子命令。`bin/devkit` 顶部声明当前边界的注释要改写：这个 CLI 不再是纯只读的，它可写的是且仅是 `.dev-kit/plans/*.yaml` 的执行期可变字段。

## 安全与兼容

所有落到文件系统的路径继续经过既有的边界检查后才使用，包括 worktree 里 `.dev-kit` 是软链接、需要 realpath 解析的情形（`lib/project.js:34-47` 已覆盖）。slug 来自目录枚举结果而非直接拼接，不引入新的路径穿越面。

`serve` 的行为、暴露路径与响应头一概不变。已有的两份 plan 不需要任何修改即可被读命令与写命令操作；`check` 会对它们报出提示级偏离，其中 `2026-07-31-pi-subagent-integration.yaml` 的 `verification.status: passed` 会报为错误级（值不在词汇表内），这正是要它报出来的那件事。

## Out of scope

- 修改冻结字段——走 `writing-plans` 重写整份 plan。
- 创建新 plan——`writing-plans` 的产物。
- 修正或迁移已偏离的 plan：`check` 只报不改。
- 并发写保护：单写者由 skill 规则保证。
- `--json` 输出、把 plan 暴露给 `serve`、跨项目操作。
- 状态转换合法性（是否允许 `todo` → `done`）。

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| 定位/校验/替换三组纯函数 | ready 闭包计算、词汇表校验、错误与提示分级、行寻址的唯一性判定与失败路径 | `dev-kit/tests/project.test.js` 直接测 `lib/` 导出 |
| 写入后的逐行比对 | 除目标行外每一行字节相同，且目标行上只有值发生变化——键、左边距与行尾注释都还在。这是「行级替换不毁文件」这个设计决定的唯一硬证据；fixture 用本仓两份真 plan 的副本，注释另用带图例的模板样本 | 无 |
| `bin/devkit plan ...` 端到端 | 退出码、stdout/stderr 内容、`--plan` 省略时的选定与歧义失败、原子写入 | `dev-kit/tests/serve.test.js` 用 `fs.mkdtempSync` 造临时项目并起真实进程 |
| `serve` 现有断言 | 暴露路径集合不变 | `dev-kit/tests/serve.test.js` 现有用例 |

fixture 取本仓两份真 plan 的副本（493 行、大量折叠标量、`review` 下有即兴扩展键的一份，与 106 行、`review`/`verification` 用词与模板不符的一份——两份都不合规，且不合的方式不同），另加若干人造坏文件覆盖悬空 `deps`、缺必需键、同一对象内键重复。新增用例并入 `dev-kit/tests/plan.test.js`，由既有的 `node --test dev-kit/tests/*.test.js` 运行。

**不能自动化的部分**：主会话是否真的会去用这组命令，不由测试决定。`executing-plans` 里那句提示的措辞由静态审查覆盖，并按 AGENTS.md 的三关判定它该不该留。

## Links

- `dev-kit/skills/writing-plans/SKILL.md` — plan 的 schema 与冻结规则
- `dev-kit/skills/executing-plans/SKILL.md` — ready 定义、恢复状态表、并行闸门
- `dev-kit/bin/devkit`、`dev-kit/lib/project.js` — 现有 CLI 的分发结构与路径边界

## Open questions

（无）

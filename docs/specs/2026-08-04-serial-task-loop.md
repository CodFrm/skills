# 串行任务循环

> Status: Draft
> Owner: dev-kit
> Last updated: 2026-08-04

**Objective:** 把 dev-kit 的任务循环收敛为「串行、单一形状、逐任务只有实现者」——删除任务级并行与四边界闸门，删除 batch reviewer，让 `subagent` 与 `inline` 只在收尾阶段有区别。

**Hard invariant:** 用户审批与破坏性/外部副作用授权、TDD 与 systematic debugging、plan 单写者、wrap-up 两轴独立静态审查、fresh runtime verification、证据真实性不变。`AGENTS.md:45` 第 2 条（`subagent` 模式主会话不审 source、commit 或 diff，只依据结构化报告决策）逐字保留。

## Problem

1. **四边界闸门的全部生产用途，是证明唯一一个按构造就安全的场合。** `.dev-kit/plans/` 下四份真实 plan 中，任务级并行的 `parallel_evidence` 条目为 **0**；30 任务的 `2026-08-01-dev-kit-evals.yaml` 连该键都不存在。历史上写出过的两条全在 `2026-08-04-pi-subagent-single-dispatch.yaml:117-128`，`tasks` 分别是 `[static-spec-verification, static-code-review]` 与其 round 2——即 wrap-up 的两轴静态评审。两条各 7 行散文，在两个不同 HEAD 上重复论证「两个只读评审不会撞车」。为一条从未走过的路，维持着 `executing-plans/SKILL.md:51-66` 的四边界表、plan 模板 `writing-plans/SKILL.md:40-47` 的一整块、`devkit plan evidence` 的七个必填 flag，以及散布在 13 份文件里的引用。

2. **该机制自带一个交付时未裁定的缺陷。** `2026-08-03-devkit-plan-cli.yaml:110-115` 记录 `devkit plan evidence` 在两份旧 plan 上都失败退出（两份都没有该键），该 plan 的 verification note `#29` 把它作为 2 条 `does not hold` 之一交付，spec 的硬不变量与「寻址失败即拒绝」何者优先至今未裁定。

3. **batch reviewer 的判据已被 implementer 自查与 wrap-up code review 两头覆盖。** implementer 提交前被要求自查 goal coverage、unrequested scope、project conventions、以及「会在错误实现下失败的测试」（`task-prompts.md:33-34`）；batch reviewer 的四条轴是 goal/spec、项目约定、batch 一致性、代码质量（`task-prompts.md:58-62`）。第 1、2、4 条与前者重叠，第 4 条同时被 `wrap-up-prompts.md:31-33` 的 code review 独立认领，其中「branch-wide duplicate/drifting implementations or interfaces」正是第 3 条 batch 一致性。第 3 条本身只因 batch 存在，而 batch 只因并行存在。

4. **`mode` 在任务循环里分叉，两条分支只有一处实质差异。** `executing-plans/SKILL.md:49` 规定 `inline` 一次一个任务且跳过 batch review，`:83-85` 为 `inline` 单独定义一道证据闸门。而该闸门要求的数据（每部分 goal 的命令、退出码、判定观察）正是 implementer 结构化返回本来就带的内容（`task-prompts.md:36-41`），两种模式没有理由用不同的收下规则。

5. **收尾状态机缺一态，真实运行时被就地发明。** `review.status` 只有 `pending → passed | stopped`（`lib/plan.js:30`），而流程在两者之间有评审与两轮修复。在飞的 `2026-08-01-dev-kit-evals.yaml` 因此写出了词表外的 `review.status: findings`、自创的 `wrapup_spec` / `status_note` / `clear_fixes` 键，并把 4 条批次修复塞进声明上限为 2 的 `review.fixes`。本轮删除 batch reviewer 会消掉其中「批次修复无处可放」这一半压力；缺态本身不在本轮范围。

## Actors and user stories

1. 作为**执行 ready plan 的主会话**，我想让任务循环只有一种形状，这样任务选择、证据收下与状态写入不再按 `mode` 或按批次分叉。
2. 作为**写 plan 的主会话**，我想在 ready 闸门只解释执行模式，不再解释并发授权，这样审批消息只包含用户真正要决定的事。
3. 作为**精简提示词的维护者**，我想承重清单只保护仍然存在的机制，这样删除 batch reviewer 不会与 `AGENTS.md:42` 字面冲突，也不会有人据此把并行闸门重新引回来。

## Design decisions

| # | Decision | Basis and rejected option |
|---|---|---|
| 1 | 删除任务级并行：`parallel_evidence`、四边界闸门、碰撞回收、batch 概念全部移除，派发一律串行 | 用户 2026-08-04 决定；四份真实 plan 的任务级 evidence 计数为 0。Rejected：保留闸门只删 CLI 命令——机制成本主要在提示词与状态，不在命令 |
| 2 | wrap-up 两轴静态评审作为具名例外同时发出，不需要任何闸门、证据或 HEAD 绑定 | 两者只读、不写工作树/index/HEAD、prompt 互不知情、结果由主会话合并，按构造无冲突；且这是闸门唯一被实际使用的场合（`2026-08-04-pi-subagent-single-dispatch.yaml:117-128`）。Rejected：一并串行化——把最贵的阶段墙钟翻倍换零安全收益 |
| 3 | 砍掉 batch reviewer，不设任何替代的中途独立评审 | 用户 2026-08-04 决定；判据已被 implementer 自查与 wrap-up code review 覆盖。Rejected：改成「未评审 commit 攒到 N 个评一次」——保住早期发现，但要引入阈值并等于给 batch 换个名字请回来；用户明确选择直接砍 |
| 4 | `inline` 的证据闸门推广到两种模式：任务离开 `doing` 的条件是主会话对 goal 每一部分记下命令、退出码与判定观察 | 这些数据 implementer 返回里已有（`task-prompts.md:36-41`），零额外派发；只读结构化报告，不碰 source，`AGENTS.md:45` 不破。Rejected：`subagent` 模式直接凭 `status: complete` 标 `done`——`done` 将不含任何证据 |
| 5 | wrap-up 一轮的全部 findings 交给一次 fixer，两轮上限不变 | 用户 2026-08-04 选择；fixer 拿到的是带 `file:line` 的 findings 清单、逐条以失败测试开场，工作量按条数而非分支大小计。Rejected：按任务/文件分组多派 fixer——重新引入扇出；Rejected：改成「直到无 blocking，最多四轮」——最贵的静态评审最多跑四遍，与压缩方向相反。取舍：30 任务规模上，一个 context 要吃下原先四个 context 分摊的修复量，可能修得浅 |
| 6 | `task.status` 去掉 `reviewing`，成为 `todo → doing → done \| blocked` | 该态的定义是「implementer commit 已存在但独立评审未完」，随 batch reviewer 一同消失；四份现存 plan 无一使用它。Rejected：保留为「已提交、未评审」的中间标记——本轮之后没有任何流程分支会读它 |
| 7 | resume 时 `doing` 任务能机械恢复 SHA 则置 `done`，恢复不出则回 `todo`。「已存在 commit 的实现者绝不重派」从被删除的 `reviewing` 恢复项换位到 `doing` 恢复项，逐字保留 | 结构化报告已随上一次会话消失，证据闸门无输入可用；wrap-up 是唯一独立审查层，由它判。本轮不为旧状态开任何兼容口子（用户 2026-08-04 决定）。Rejected：一律回 `todo`——会在已有 commit 上重做，正是该规则禁止的事，而该规则现位于 `executing-plans/SKILL.md:23`，与那一行一同被删，故必须换位 |
| 8 | `AGENTS.md:44` 第 1 条替换而非删除；`:42` 的「独立静态审查」限定为 wrap-up 两轴 | 「默认串行」仍承重（仍有 implementer、两个 reviewer、verifier 要派），删净会让它在下一次精简时被当废话删掉；不限定则承重清单与决策 3 字面冲突，且可据以把闸门引回。Rejected：整条删除；Rejected：只删不限定 |
| 9 | 不修改 `docs/specs/2026-08-04-pi-subagent-single-dispatch.md` 决策 #2 对四边界闸门的引用 | spec 是历史记录，不为迎合实现而改写；该处依据被本 spec 取代，由本 spec 记录这一点。Rejected：就地改写那句——会让已获批的历史 spec 不再是当时的约定 |

## 任务循环

执行一个 ready plan 时，主会话收集 `status: todo` 且全部 `deps` 为 `done` 的任务，**每次只选一个**。不存在批次，不存在并发候选，`mode` 不改变这一段的任何行为。

选中后写 `doing` 并派发实现者：目标、被服务的 spec 需求、`files`、模型档位、强制 `test-driven-development`（故障则先 `systematic-debugging`）。实现者只提交自己的任务、按路径提交、不写 plan。

实现者返回后，主会话按返回的 `status` 路由：`complete` 与 `complete with concerns` 要求 SHA 能被 `git cat-file -e <sha>^{commit}` 解析；`missing context` 补入已验证的缺失事实后重派，出现矛盾交用户；`stuck` 必须先改变某个条件（补上下文、提档位、重切 plan、或标 `blocked`）再重试。

**任务离开 `doing` 的唯一条件**：主会话从实现者的结构化返回中，为 goal 的每一部分记下一条命令、它的退出码与判定观察。满足则 `done`，随后跑全量测试，红则先诊断再选下一个任务。实现者自陈某部分未达成时退回一次，第二次自陈缺口标 `blocked`。主会话在任何情况下都不读 source、commit 或 diff 来补足这道闸门。

## 收尾

全部任务 `done` 或 `blocked` 后进入静态收尾。两轴评审——spec 验证轴读获批 spec 与整分支 diff，code review 轴只读整分支 diff——以 `strong` **同时发出**，只读，互不知情，不得合并，不得把先前结论写进任一 prompt。`inline` 模式下由主会话按同样两份 prompt 自行完成。

第一轮的全部 findings 交给一个全新 fixer，逐条以失败测试开场，记录其 SHA 并跑全量测试。随后重跑两轴。若仍有 blocking findings，只把这些交给最后一个全新 fixer，记录 SHA、跑全量测试，不再跑第三轮。红的测试套件或用尽额度后仍存在的 blocking finding 置 `review.status: stopped`；其余 findings 记入任务 `note`。

runtime verification 不因本轮改变：静态收尾通过后派发全新 verifier，其后的报告核对、`.env` 缺失路由与交接一律保持现状。

## 恢复

会话开始时发现未 `done` 的 plan，按任务状态恢复：

- `doing`：从历史机械恢复其 SHA。恢复得到则置 `done`，交由收尾评审判断；无法机械恢复且需要判断时，派一个只读 scout 定位 commit 而不评价它；仍无结果则回 `todo`。已存在 commit 的实现者绝不重派。
- `verification` 各态与其处置保持现状。

恢复表不再含 `reviewing`。

## plan 文件与 CLI

plan 模板不再有 `parallel_evidence` 段。`task.status` 的合法值为 `todo`、`doing`、`done`、`blocked`。

`devkit plan` 去掉 `evidence` 子命令及其七个 flag，`check` 不再校验 evidence 条目的键。用 `--status reviewing` 写任务状态自本轮起失败并列出合法值。

## 引用清理

移除 `#parallel-is-proved-not-assumed` 之后，下列文件不得残留指向该锚点的链接或以四边界闸门为前提的句子：`dev-kit/README.md`、`skills/using-dev-kit/SKILL.md`（注入每个会话的引导）、`skills/using-dev-kit/references/dispatching.md`、`claude-tools.md`、`codex-tools.md`、`pi-tools.md`、`skills/systematic-debugging/SKILL.md`、`skills/init/SKILL.md`、`skills/writing-plans/SKILL.md`、`skills/executing-plans/references/prompts.md`、`task-prompts.md`、`wrap-up-prompts.md`、`.pi/extensions/subagent/README.md`。三份平台工具映射中「派发一个闸门批准的并行批次」一行随之移除；Pi 与 Codex 的多调用并行描述改述为仅适用于 wrap-up 两轴。

`AGENTS.md` 的两条编排硬约束改为：第 1 条声明派发默认串行、唯一例外是 wrap-up 两轴静态评审（只读、不写工作树/index/HEAD、不共享可变资源，可同时发出）；第 2 条逐字保留。承重清单中的「独立静态审查」明确指 wrap-up 两轴。

## Out of scope

- wrap-up 在两轴均无 findings 时的短路（当前未指定，会白跑第二轮）
- reviewer 被替换后仍不合格的上限（`executing-plans/SKILL.md:130` 无上限，verifier 侧 `:146` 有）
- `review.status` 缺失的「已评审、findings 在案、修复未完」一态
- `.env` 缺失依赖的三行路由表压缩
- `plan.status: stopped` 无人写入
- `references/prompts.md` 顶部无人导航的 stage 表、`writing-plans` 结尾复述正文的 checklist
- `docs/specs/2026-08-04-pi-subagent-single-dispatch.md` 的任何修改
- 可选 CLI 写入层本身的存废（另议）

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| `dev-kit/tests/plan.test.js` 中模板与 `VOCAB` / `KEYS` 的逐字相等断言 | 提示词模板与 `lib/plan.js` 的状态词表、schema 键同步；`reviewing` 与 `parallel_evidence` 在两处同时消失 | 现有 `plan.test.js:62`、`:72`；`:83-85` 从模板注释推导 `KEYS.evidence`，随该块一并删除 |
| `devkit plan task <id> --status reviewing` | 已移除的状态被拒绝并列出合法值，不写入文件 | 现有 off-vocabulary 拒绝用例 |
| `devkit plan evidence` | 子命令不再存在，报未知子命令并打印 usage | 现有未知子命令用例 |
| `AGENTS.md` 的锚点校验脚本 | 13 份文件中无指向已删锚点的断链 | `AGENTS.md`「删完之后」一节 |
| `node --test dev-kit/tests/*.test.js` | 全绿，含 manifests 一致性 | 现有测试目录 |

无法自动化的部分：提示词正文是否仍然可执行（动作、状态、责任人、输入、输出、停止条件齐全），以及承重边界是否被精简误伤。由 wrap-up 的两轴静态评审对照本 spec 与 `AGENTS.md` 三关判断；runtime verification 以一次真实的 `executing-plans` 走查覆盖循环形状。

## Links

- `AGENTS.md:42,44,45` — 承重清单与两条编排硬约束
- `dev-kit/skills/executing-plans/SKILL.md:40,44,49,51-66,70,83-98,102,113,128`
- `dev-kit/skills/writing-plans/SKILL.md:33,40-47,60,71,90,94,98`
- `dev-kit/lib/plan.js:26-42,385-388,628,642-654,804-808`
- `.dev-kit/plans/2026-08-04-pi-subagent-single-dispatch.yaml:117-128` — 仅有的两条 evidence
- `.dev-kit/plans/2026-08-03-devkit-plan-cli.yaml:110-115` — evidence 命令的未裁定缺陷
- `docs/specs/2026-08-04-pi-subagent-single-dispatch.md` 决策 #2 — 其对四边界闸门的依据被本 spec 取代

## Open questions

无。

# Pi subagent 单任务派发

> Status: Approved
> Owner: dev-kit
> Last updated: 2026-08-04

**Objective:** 将可选 Pi `subagent` 工具收敛为“一次调用派发一个任务”，由主会话用多次调用编排并行或串行，并通过三个内置 profile 决定子进程工具边界。

**Hard invariant:** 基础 dev-kit 仍不自动提供 subagent；只有当前 Pi 会话真实加载可选包时才能选择 `subagent`，且任何被派发子进程都不能再次获得本包的 `subagent` 工具或接管主会话的编排与 plan 状态职责。

## Problem

1. **工具同时承载单任务、并行批次和串行链，重复了 Pi 与主会话已有的编排能力。** 当前 schema 同时暴露单任务字段、`tasks` 和 `chain`（`dev-kit/.pi/extensions/subagent/lib/schema.ts:1-22`），执行器再自行选择模式、限制并发、聚合结果和替换 `{previous}`（`dev-kit/.pi/extensions/subagent/lib/modes.ts:32-188`）。Pi 默认会并行执行同一 assistant message 中的多个工具调用，dev-kit 的 Claude 与 Codex 映射也分别用多个 `Task` 或 `spawn_agent` 调用表达并行（`dev-kit/skills/using-dev-kit/references/claude-tools.md:7-11`、`codex-tools.md:7-13`）。用户在 2026-08-04 选择把并行与串行留给主模型编排。

2. **平铺的多模式 schema 令无关参数进入普通调用。** 仓库曾专门修复模型给 inactive mode 填空字符串或空数组的情况（commit `05a8686`；`dev-kit/tests/pi-subagent-modes.test.js:96-118,155-176`）。这些兼容分支只服务工具内部的多模式传输，删除多模式后不再产生价值。

3. **`profile` 与调用级 `tools` 同时控制工具边界，形成两层重叠配置。** 当前校验先按 profile 选择默认工具，再允许调用覆盖，并校验覆盖是否落在 profile 边界内（`dev-kit/.pi/extensions/subagent/lib/validation.ts:6-10,48-61`）。用户决定只保留 profile，由包拥有稳定的工具集合，不再让每次调用拼装 allowlist。

4. **现有禁止递归主要依靠 allowlist 与提示词，没有阻止已安装包在子 Pi 启动时再次注册工具。** 当前请求会拒绝显式 `subagent` 工具名，子进程提示词也禁止再次派发（`dev-kit/.pi/extensions/subagent/lib/validation.ts:52`、`invocation.ts:168-170`），但子进程按 Pi 规则仍会加载用户级 extension。用户要求在工具注册层也固定排除本包，避免递归能力仅靠模型遵守。

## Actors and user stories

1. 作为**执行 ready plan 的主会话**，我想一次只派发一个有完整边界的任务，这样任务选择、并发授权、串行依赖、结果裁剪和 plan 状态始终由唯一 orchestrator 掌握。
2. 作为**被派发的实现者、审查者或验证者**，我想从明确的 profile 获得与任务匹配的工具集合，这样无需理解另一层 allowlist 配置，也不能再次派发 subagent。
3. 作为**需要项目自定义工具的调用方**，我想选择 `general` 继承父会话当前启用的工具，这样 browser、artifact 或项目 extension 能进入子进程，同时 `subagent` 仍被固定排除。
4. 作为**维护者**，我想只维护单任务进程协议及其 renderer，这样并发池、chain 替换、批次聚合和 inactive-mode 兼容不再扩大实现与测试面。

## Design decisions

| # | Decision | Basis and rejected option |
|---|---|---|
| 1 | 一次 `subagent` 调用只接受并执行一个任务 | 用户选择；Claude Code 和 Codex CLI 的原生派发也是单任务调用，多个调用由 harness 编排。Rejected：保留 `tasks` / `chain`——重复主会话职责并继续暴露无关参数 |
| 2 | 并行由主模型在同一消息中发出多个独立调用，串行由主模型收到结果后再发出下一次调用 | Pi 默认并行执行 sibling tool calls，dev-kit 的 exact-HEAD 四边界闸门继续拥有并发授权。Rejected：extension 内并发池或 `{previous}`——隐藏任务选择、失败裁决与上下文裁剪 |
| 3 | 保留 `profile`，删除调用级 `tools` | 用户选择；一个显式 profile 足以表达稳定权限预设。Rejected：只保留 `tools`——每次重复长 allowlist，且缺少命名的行为边界；Rejected：同时保留——继续两层重叠配置 |
| 4 | profile 固定为 `read-only`、`write`、`general` | 用户选择；前两者覆盖稳定的基础读写任务，`general` 覆盖当前会话已启用的额外能力。Rejected：只保留读写两档——runtime verification 等任务无法使用项目自定义工具 |
| 5 | `general` 继承父会话当前 active tools，保持唯一集合并固定排除精确名称 `subagent` | 用户确认；active set 比所有已注册工具更贴近父会话实际授权。Rejected：继承所有 registered tools——会启用父会话没有启用的能力；Rejected：允许调用覆盖——重新引入 `tools` 参数 |
| 6 | 禁止递归同时落在工具解析、子进程注册和 system prompt 三层 | 用户要求固定排除；单层提示词不能证明能力不存在。Rejected：只从 allowlist 删除——本包仍在子进程注册；Rejected：只加提示词——依赖模型自律 |
| 7 | 保留现有 model、thinking、cwd、trust、JSONL、usage、abort 与失败证据语义 | 本轮目标是收窄派发契约，不改变已验证的单任务进程边界。Rejected：同时重做 runner 或 session 生命周期——扩大交付面且没有新需求 |
| 8 | 新 schema 直接拒绝 `tasks`、`chain` 和 `tools`，不提供旧调用形状转换 | 用户要求砍掉这些能力；明确失败比静默降级或取第一项更可信。Rejected：兼容转换——无法无歧义地把多任务调用变成一次单任务调用 |

## Public dispatch contract

当前 Pi 会话已加载可选包时，工具只接受下列契约：

```typescript
subagent({
  task: string,
  profile: "read-only" | "write" | "general",
  model?: string,
  thinking?: string,
  cwd?: string
})
```

`task` 必须是非空、完整且可独立执行的 prompt，并拥有任务边界、必要上下文和返回格式。`profile` 必填且必须是三个合法值之一。调用出现未知字段、空任务、未知 profile、无效 cwd、格式错误的显式 model 或不受支持的 thinking level 时，必须在启动子进程前失败并指出具体字段。

工具不接受批次、chain、prior-output placeholder、后台 agent id 或调用级工具覆盖。一个成功调用只对应一个新 Pi 子进程和一个任务结果。

## Orchestration

主会话默认串行派发。只有 `executing-plans` 已针对当前精确 HEAD 记录写集、语义依赖、共享可变资源和独立验证四个边界的证据时，主模型才可在同一 assistant message 中发出多个 `subagent` 调用；Pi 负责并行执行这些 sibling calls，每个调用独立启动、流式更新、失败和返回。

串行依赖由主会话显式处理：前一个调用返回后，主会话判断是否继续、选择下一任务、裁剪需要传递的事实并形成新的完整 task。工具不机械传递整个前序输出，也不在失败后自行选择后续步骤。

extension 不读取 plan、不判断任务依赖或文件重叠、不保留跨调用队列、不设置并发上限、不聚合 sibling results，也不写 `.dev-kit/plans/*.yaml`。子 agent 的结果是报告，不是状态转换许可。

## Profiles and tool resolution

### `read-only`

`read-only` 固定启用 `read,bash,grep,find,ls`。子进程收到明确约束：不得修改文件、仓库状态或外部系统，bash 只用于 `git diff`、`git show`、`git log` 等只读检查。该 profile 供调查、静态 spec verification 和静态 code review 使用。

`read-only` 是工具裁剪与行为约束，不是 OS sandbox；bash 仍以当前用户权限运行。因此完整 task prompt 仍必须写明只读范围，自动化也不得声称能证明任意 shell 命令无副作用。

### `write`

`write` 固定启用 `read,bash,edit,write,grep,find,ls`。它供实现、review-and-fix 和不需要项目自定义工具的落盘任务使用。实际可修改的路径、外部副作用和提交边界由 task prompt 与项目规则拥有，profile 不扩大这些边界。

### `general`

`general` 在每次调用时取得父 Pi 当前 active tools，按首次出现保留唯一工具名，并无条件排除精确名称 `subagent`。若过滤后为空，子进程以无工具模式启动。它供确实需要父会话已启用的 browser、artifact、项目 extension 或其他非基础工具的任务使用。

`general` 不从所有 registered tools 扩大 active set，也不允许调用者增删工具。若某个父 active tool 因子进程 cwd、trust 或资源加载差异而在子 Pi 中不可用，该任务失败并返回 Pi 诊断；工具不得静默删除该能力后继续，也不得 fallback 到更宽的工具集合。

## Recursion boundary

任何 profile 解析出的子工具集合都不得包含精确名称 `subagent`。启动的子 Pi 必须携带仅供包内部识别的 child 标记；本包发现该标记时不得注册 `subagent` 工具。子进程追加 system prompt 还必须说明它是被派发执行单个任务的上下文，不得调用或委派 subagent、不得向用户提问、不得接管整份 plan，并应服从 `using-dev-kit` 的 `SUBAGENT-STOP`。

这三层分别约束模型可见工具、extension 注册和模型行为。即使父会话的 active set 包含 `subagent`，`general` 子进程也观察不到本包的递归入口。

## Model, working directory and trust

未提供 `model` 时，子进程继承父会话当前 `provider/model`；未提供 `thinking` 时继承父会话当前 thinking level。显式 model 必须是真实 `provider/model`，不存在、未认证或不能启动时返回原始失败诊断，不静默切换模型。dev-kit plan 继续只保存 `cheap / mid / strong`，主会话在派发时根据当前环境解析并传入真实模型。

未提供 `cwd` 时使用父会话 cwd；提供时按父 cwd 解析绝对或相对路径，并在启动前确认它是存在的目录。父项目已信任且解析后的 cwd 等于父 cwd 或位于其下时，子 Pi 使用本次运行的一次性 approval；父项目未信任或 cwd 位于父 cwd 外时使用一次性拒绝。profile 和工具裁剪不改变 Pi extension 代码仍以当前用户系统权限运行的事实。

每个任务仍启动独立的 Pi JSON/print 子进程并关闭 session 持久化，因此不继承父消息历史，也不在 session 列表留下可恢复 agent。

## Output, failure and recovery

子进程 JSONL 事件继续流式进入当前工具调用。折叠与展开视图只展示这一任务的 prompt、工具调用、最终输出、turns、token/cache、cost、context、模型和失败信息，不再展示 mode、batch、step 或 aggregate 状态。

成功时返回该任务最终输出及完整 details。非零退出、`stopReason: error`、进程启动失败、外部 signal 或父调用 abort 时，返回 exit code、stop reason、错误消息、stderr 和最后可用输出；Escape 或 Ctrl+C 必须先终止当前调用拥有的子进程，超时后再强制结束。一个 sibling call 的失败不由 extension 取消、重试或裁决其他 sibling calls，主会话从各自工具结果决定下一步。

调用结束后不保留可继续的子 agent 状态。需要后续工作时，主会话形成新的完整 task 并发起新调用。

## Compatibility, security, privacy and accessibility

新 schema 不再接受 `tasks`、`chain` 或 `tools`，包括空数组和空字符串形式。已保存 session 中已经完成的旧工具结果保持可读；任何重新发出的旧形状调用明确失败，不取第一项、不串行展开、不忽略未知字段。

可选包与基础 dev-kit 的安装边界不变，不新增 agent profile 文件、持久模型映射、网络端点或凭据存储。子进程继续沿用 Pi 已配置的 provider 认证；包不主动把凭据加入 prompt 或结果。命令和模型输出仍可能包含项目自身打印的敏感值，调用方必须遵守项目现有日志与凭据规则。

`general` 可能继承具有写入或外部副作用的 active tools，选择该 profile 的主会话必须在 task 中写明授权边界。任何未获用户授权的破坏性或外部副作用仍由 dev-kit 现有门禁禁止。

该改动没有业务 UI 或个人数据模型。TUI 继续使用 Pi 主题和 Ctrl+O 展开机制，但只保留单任务视图；JSON/print 模式不依赖交互 UI。终端宽度、键盘中止和主题适配沿用当前 renderer 边界。

## Relationship to the original integration spec

本规格替代 [`2026-07-31-pi-subagent-integration.md`](./2026-07-31-pi-subagent-integration.md) 中关于 single/parallel/chain 派发契约、调用级 `tools`、批次输出和并发池的要求。原规格拥有的可选 package 安装边界、基础 dev-kit 保持 inline、动态 model resolution、cwd/trust、无 session 子进程、证据真实性和上游 attribution 继续有效。

## Out of scope

- npm 发布、远程 package gallery 或版本发布流水线。
- 自动判断模型强弱或保存 `cheap / mid / strong` 映射。
- 用户自定义 profile、调用级工具增删或兼容外部 agent definition 文件。
- OS 级沙箱、容器隔离或对 bash 命令做完整副作用证明。
- extension 内并发池、任务上限、批次聚合、chain、`{previous}` 或 sibling-call 失败联动。
- 后台持久 subagent、跨会话恢复、agent id 续用或子 agent 再派发。
- 改变 dev-kit 的 task 切分、exact-HEAD 并行闸门、review 顺序、runtime verification 判据或 plan 单写者边界。
- 在一个已启动的子进程中切换 profile、model、thinking、cwd 或工具集合。

## Testing decisions

用户在 2026-08-04 的设计确认中接受以下测试边界。

| Seam | What it verifies | Prior art |
|---|---|---|
| 工具注册与 JSON schema | 只暴露 `task/profile/model/thinking/cwd`；`task`、`profile` 必填；旧字段和未知字段被拒绝 | `dev-kit/tests/pi-subagent-single.test.js` 的假 ExtensionAPI 加载方式 |
| 三个 profile 的 CLI 工具参数与 system prompt | `read-only`、`write` 使用固定集合；`general` 继承 active tools、去重并排除 `subagent`；只读和禁止递归提示存在 | `dev-kit/tests/pi-subagent-single.test.js:58-218` |
| child 注册边界 | 父进程加载包会注册工具；带 child 标记加载同一包不会注册 `subagent` | 当前仓库无同类测试 |
| 两次独立调用配合可控延迟的假 Pi | extension 无内部批次或队列，两个调用能同时拥有并运行各自子进程且结果互不混合 | `dev-kit/tests/pi-subagent-modes.test.js:96-132` 的时间线夹具可复用，但不保留 batch API |
| 假 Pi JSONL 单任务协议 | model/thinking 继承与覆盖、cwd、trust、stream、usage、exit、signal、abort 和最后输出保持原行为 | `dev-kit/tests/pi-subagent-single.test.js`、`dev-kit/tests/fixtures/fake-pi.js` |
| 单任务 renderer | 折叠/展开只呈现一个任务及其 progress、usage、model 和 error，不再包含 parallel/chain 状态 | `dev-kit/tests/pi-subagent-render.test.js` |
| Pi platform mapping 与文档 | 有工具时提供 `subagent`；并行写成同消息多个调用，串行写成收到结果后新调用；profile 契约与递归边界一致 | `dev-kit/tests/platform-tools.test.js`、现有 package README |
| 仓库门禁 | package 边界、hooks、manifests、CLI 和其他平台映射没有回归 | `node --test dev-kit/tests/*.test.js` |

不向真实 provider 发自动化请求：假 Pi 可以证明 schema、进程参数、并发重入、JSONL、失败和 abort，不能证明模型会正确服从 task。模型行为继续由任务证据、独立静态审查和 fresh runtime verification 判断。`read-only` 对 bash 的无副作用约束也不伪装成沙箱测试；自动化只证明写工具未进入固定集合且提示词存在。Pi sibling tool calls 的调度器属于上游 harness，本仓库只验证 extension 的两个独立调用没有共享队列或结果污染，不复制测试 Pi 核心调度实现。

## Open questions

无。

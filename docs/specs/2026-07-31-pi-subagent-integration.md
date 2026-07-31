# Pi subagent 可选集成包

> Status: Approved
> Owner: dev-kit
> Last updated: 2026-07-31

**Objective:** 给 dev-kit 增加一个自包含、可单独安装的 Pi subagent 集成包，使安装后执行 `/reload` 就能在计划 ready 闸门中选择 `subagent`，无需创建或维护用户级 agent 文件。

**Hard invariant:** 只安装基础 dev-kit 时仍按 Pi 基础工具映射走 `inline`；只有当前会话真实暴露集成包的 delegation 工具时才能选择 `subagent`，且不得用 shell 手动递归启动 Pi 冒充已安装的派发能力。

## Problem

1. **基础 Pi 会话没有 dev-kit 可调用的 subagent。** [`pi-tools.md:14-16`](../../dev-kit/skills/using-dev-kit/references/pi-tools.md) 把原生派发标为不可用，并要求基础工具集选择 `inline`；[`writing-plans/SKILL.md:121`](../../dev-kit/skills/writing-plans/SKILL.md) 因而只能在 harness 暴露派发工具时提供 `subagent`。**观察到的代价**：本次会话实际只暴露基础工具，用户要求安装 subagent 后又把需求收敛为“安装后 `/reload` 即可让计划 gate 提供 subagent 选项”。

2. **Pi 官方示例依赖独立 agent 定义，不满足零配置安装边界。** `@earendil-works/pi-coding-agent` 0.82.1 的 `examples/extensions/subagent/index.ts:431-468` 让调用方传 agent 名称，再从用户或项目 agent 目录发现配置；Pi package 文档 `docs/packages.md:5,125-128,162-165` 只把 extensions、skills、prompts、themes 作为 package resource，没有 agent profile 这一类资源。原样打包会继续要求用户在包外创建 `.md` 文件，或由安装器复制并在卸载后留下残余。（弱证据：文档和代码陈述当前边界，不是已执行安装的故障。）

3. **官方示例把模型固定在 agent 配置里。** 同一版本的 `examples/extensions/subagent/index.ts:294-295` 从 agent 定义读取模型并传给子 Pi；本机 `pi --list-models` 实际返回 `local-llm/gpt-5.6-luna`、`local-llm/gpt-5.6-sol`、`local-llm/gpt-5.6-terra`，与示例 agent 写死的 Claude 模型不相符。dev-kit 的 plan 只保存 `cheap / mid / strong` 相对层级，真正派发时必须针对当前机器选择真实模型，而不是让安装包保存一份会漂移的映射。（弱证据：环境与示例已核对，但尚未用原样示例触发失败。）

4. **基础 dev-kit 包当前有明确而窄的 Pi 资源边界。** [`dev-kit/package.json:23-27`](../../dev-kit/package.json) 只加载 bootstrap extension 与共享 skills。把 subagent 直接加入该 manifest 会令所有 Pi 用户自动获得进程派发能力，违背“可选集成包”的要求；把它放在自动发现的 `*/index.ts` 位置，又会使维护者进入 `dev-kit/` 目录时未经安装就加载。（弱证据：manifest 和 Pi discovery 规则陈述会发生什么，尚未做错误方案的安装实验。）

## Actors and user stories

1. 作为**在 Pi 中使用 dev-kit 的开发者**，我想单独安装 subagent 集成并执行 `/reload`，这样下一份 plan 的 ready 闸门会提供真正可用的 `subagent`，而不是让我手工配置多个 agent 文件。
2. 作为**执行 ready plan 的主会话**，我想在每次派发前读取当前机器实际可用的模型并把确定的模型传给 subagent，这样 plan 的相对层级不会变成失效或虚构的模型 ID。
3. 作为**被派发的实现者或验证者**，我想拿到独立上下文、明确的工作目录、工具权限和任务返回格式，这样我只完成被分配的工作并把可判断的证据交回主会话。
4. 作为**只安装基础 dev-kit 的用户**，我想继续获得当前的 inline 行为，不因仓库新增一个可选包而自动启动额外 Pi 进程。
5. 作为**维护者**，我想能从官方示例追踪适配代码的来源，并用假 Pi 子进程验证协议，而不让测试消耗真实模型请求。

## Design decisions

| # | Decision | Why（以及被否掉的） |
|---|---|---|
| 1 | 集成作为基础 dev-kit manifest 之外的独立 Pi package | 只有显式安装才获得派发能力，见[安装与激活](#installation-and-activation)。Rejected：加入基础 manifest——所有 Pi 用户自动启用；Rejected：安装器复制 agent 文件——卸载残留且可能撞名 |
| 2 | 包放在 dev-kit 的 Pi extension 目录下，但入口不是自动发现的 `index.ts` | 与 Pi 适配代码放在一处，同时保持“必须单独安装”的边界。Rejected：`subagent/index.ts`——维护者以 `dev-kit/` 为 cwd 时会被项目级自动发现 |
| 3 | 以 Pi 0.82.1 官方 subagent 示例为上游，保留 single、parallel、chain、流式结果、usage 与中止传播，替换外部 agent discovery 为内置权限 profile | 用户已选择自包含适配版；见[派发契约](#dispatch-contract)。Rejected：原样示例——仍需包外 agent 文件；Rejected：重新发明完全不同的 runner——失去上游可比性 |
| 4 | 每个任务显式选择 `write` 或 `read-only` profile，模型使用可选的真实 `provider/model` 参数 | 权限不能靠默认猜；模型层级则由主会话按当前环境解析，见[模型在派发时解析](#model-resolution-at-dispatch)。Rejected：agent 名字同时编码角色和模型——组合膨胀并重新引入 profile 管理 |
| 5 | 不保存 `cheap / mid / strong` 的持久映射 | 用户确认“支持指定模型，跑的时候再找和分配”即可；可用模型会随机器、provider 和认证变化。Rejected：配置命令或 JSON 映射——增加状态与失效清理；Rejected：按名字、价格猜强弱——Pi 元数据不提供可靠能力排序 |
| 6 | 子进程继承父会话的项目 trust 结论，但永远不能获得 `subagent` 工具 | 已信任项目不应在每个非交互子进程里丢失项目资源，未信任项目也不得被提升；禁止递归保持主会话是唯一 orchestrator。Rejected：一律 `--approve`——扩大权限；Rejected：一律禁用 extensions——runtime verifier 可能需要已信任的项目工具 |
| 7 | 本轮只提供本地路径安装，不发布 npm 包 | 当前仓库的 dev-kit 本身也是本地 Pi package，远程发布没有现成流程。Rejected：把发布流水线并进本轮——与派发行为无关且扩大交付面 |
| 8 | 进程协议用假 Pi 可执行文件测试，真实模型质量留给静态审查与运行时验证 | 自动化应覆盖参数、JSONL、并发、失败和 abort，不应产生模型费用或依赖认证；见[测试决策](#testing-decisions) |

## Installation and activation

集成包位于 `dev-kit/.pi/extensions/subagent/`，自身有 Pi package manifest，入口是该目录下一个显式声明的 TypeScript 文件。基础 `dev-kit/package.json` 继续只加载 bootstrap extension 与 skills，不引用这个包。

用户从仓库 checkout 以绝对或相对本地路径执行 `pi install <dev-kit/.pi/extensions/subagent>`。安装成功但当前会话尚未 reload 时，已有工具集合不变；执行 `/reload` 后，Pi 注册名为 `subagent` 的工具。此时 [`pi-tools.md`](../../dev-kit/skills/using-dev-kit/references/pi-tools.md) 把它识别为已安装的 delegation 能力，`writing-plans` 的 ready 闸门才同时展示 `subagent` 与 `inline`。安装包缺失、被禁用或卸载并 reload 后，映射重新只提供 `inline`。

安装不创建、覆盖或读取 `~/.pi/agent/agents/*.md` 与项目 `.pi/agents/*.md`。卸载包不需要清理 agent profile 或模型映射。

## Dispatch contract

工具支持且每次只能选择一种模式：single 接受一个任务；parallel 接受多个相互独立的任务；chain 顺序执行任务，并允许后一步在自己的 task 文本中用 `{previous}` 接收前一步最终输出。parallel 最多接受八个任务，同时最多运行四个；超出上限时在启动任何子进程之前失败。

每个任务具有同一组字段：

| Field | Contract |
|---|---|
| `task` | 必填；完整、可独立执行的派发 prompt，返回格式由它拥有 |
| `profile` | 必填；只能是 `write` 或 `read-only` |
| `model` | 可选；真实的 `provider/model`，不是 `cheap / mid / strong` |
| `thinking` | 可选；Pi 支持的 thinking level，由目标模型按自身能力裁剪 |
| `tools` | 可选；在 profile 边界内替换默认 allowlist，可包含当前已加载的其他工具，但不能包含 `subagent` |
| `cwd` | 可选；绝对路径，或相对父会话 cwd 解析的目录 |

`write` 的默认工具是 `read,bash,edit,write,grep,find,ls`，供实现任务、batch review-and-fix 与 runtime verifier 使用；它的显式 `tools` 可以加入当前 Pi 已加载的项目工具，但不能加入 `subagent`。`read-only` 的默认工具是 `read,bash,grep,find,ls`，供只读调查和两个静态收尾 reviewer 使用；它的显式 `tools` 只能从这份默认表中删减，不能加入未知自定义工具，追加 system prompt 只允许 bash 执行 `git diff/show/log` 等无副作用命令。这个 profile 是模型工具边界和行为约束，不宣称为操作系统沙箱。

未知 profile、互相冲突的模式、空任务、无效 cwd、`write` 请求 `subagent`，或 `read-only` 请求默认表之外的工具，都在启动子进程之前失败，并把具体字段错误返回主会话。

## Model resolution at dispatch

plan 继续只保存 `cheap / mid / strong`。执行者准备一次派发时，先从当前 Pi 环境取得真实可用模型，按任务的相对层级和现有模型能力分配一个实际 `provider/model`，再把该值传给工具。不得把相对 tier 当模型 ID，也不得引用 `pi --list-models` 没列出的模型；当前环境只有一个可用模型时，三个 tier 可以全部落到它。

集成包不判断哪个模型“更强”，不从名字、成本或列表顺序推导 tier，也不保存跨会话映射。调用没有提供 `model` 时，子进程继承父会话当前的 provider/model；没有提供 `thinking` 时继承父会话当前 thinking level。显式模型不存在、无认证或不能启动时，该任务失败并返回 Pi 的诊断，不静默换到另一个模型。

## 子进程生命周期与上下文

每个任务启动一个独立 Pi print/JSON 进程，关闭 session 持久化，因此不继承父会话的消息历史，也不在 session 列表留下子任务。它继承进程认证环境，使用任务解析后的 cwd、模型、thinking 与工具 allowlist，并收到一段最小追加 system prompt：说明它是已派发 subagent，应触发 `using-dev-kit` 的 subagent stop；只执行 task；不能向用户提问；严格服从 task 的返回格式；不得再次派发 subagent；`read-only` 时不得产生副作用。

任务 cwd 等于父会话 cwd 或位于其下，且父会话已信任当前项目时，子进程使用一次性 project approval；父会话未信任，或 cwd 解析到父 cwd 之外时使用一次性拒绝。用户级 extensions 仍按 Pi 正常规则加载；项目级资源只在这条 trust 边界成立时加载。工具 allowlist 决定模型能调用哪些工具，但 extension 初始化代码仍拥有 Pi 进程本身的系统权限。

cwd 在启动前解析并验证为存在的目录。不同 parallel task 可以使用同一 worktree，也可以显式指定其下的不同目录；集成包不读取 plan、不判断 `files` 是否重叠，是否并行仍由 dev-kit orchestrator 按现有规则决定。

Escape 或 Ctrl+C 中止父工具调用时，所有仍在运行的子进程收到终止信号；超时后的强制结束沿用官方示例的边界。已经完成的 parallel 结果保留，未完成项标记 aborted。

## 输出、错误与恢复

子进程的 JSONL 事件被流式解析。工具调用和文本进度进入 Pi 的工具更新，最终输出保留官方示例的折叠/展开展示、每任务 turns、token/cache、cost、context 与模型信息。parallel 返回每个任务独立的小结；每个任务送回父模型的文本最多 50 KB，完整消息仍留在 tool details，避免一个嘈杂任务吃掉主会话上下文。

single 在非零退出、模型 `stopReason: error`、abort 或进程启动失败时返回该任务的 exit code、stop reason、错误消息、stderr 与最后可用输出。parallel 不因一个任务失败丢弃兄弟任务结果，汇总成功和失败数量并逐项标出失败原因。chain 在第一个失败步骤停止，失败输出不替换 `{previous}` 继续传给后续步骤。

subagent 的“completed”只是一份报告，不改变 plan 状态。主会话继续按 `executing-plans` 的证据门槛检查命令、退出码、观察与 commit，并且只有主会话写 plan。

## 与 dev-kit 的路由关系

Pi mapping 拥有平台工具翻译：基础 Pi 仍声明没有原生派发工具；当实际工具列表出现本包的 `subagent` 时，mapping 使用本 spec 的 profile、模型和模式契约。`writing-plans` 仍只负责 ready 闸门，不复述工具 schema；`executing-plans` 仍拥有任务选择、并行条件、prompt 模板、review 与 verification 顺序。

子 agent 不重新进入 dev-kit 主链。它看到的追加 system prompt 明确自己是被派发执行具体任务的上下文，因此命中 `using-dev-kit` 的 subagent stop，直接服从任务中点名的 TDD、systematic debugging、review 或 verification 规则。

## 兼容性、安全、隐私与可访问性

实现以本机安装的 `@earendil-works/pi-coding-agent` 0.82.1 `examples/extensions/subagent/` 为明确上游，保留 MIT attribution，并在 NOTICE 中记录版本与来源。package manifest 把 Pi 提供的核心包和 `typebox` 列为 `peerDependencies: "*"`，不复制它们进仓库。

Pi package extension 与子 Pi 进程都以用户权限运行；profile、project trust 和工具 allowlist 不是 OS sandbox。包不主动读取认证文件、不把 API key 加进 prompt 或结果，也不新增网络端点；子进程沿用 Pi 已配置的 provider 认证。stderr 和模型输出可能包含项目命令自己打印的敏感值，使用者仍须遵守项目现有凭据和日志规则。

该改动没有业务 UI、个人数据模型或可访问性流程。TUI 只新增沿用 Pi 主题与 Ctrl+O 展开的工具行；纯 JSON/print 模式不依赖交互 UI。终端窄宽度、键盘中止和主题适配沿用官方 renderer。

## Out of scope

- npm 发布、版本发布流水线或远程 package gallery 上架。
- 自动判断模型强弱、保存 `cheap / mid / strong` 映射，或新增模型配置命令。
- 复制、迁移或兼容用户已有的 `~/.pi/agent/agents/*.md` 与项目 `.pi/agents/*.md`。
- OS 级沙箱、容器隔离或对 bash 命令做完整的副作用证明。
- 后台持久 subagent、跨会话恢复子 agent、继续某个子 agent 的历史上下文。
- 改变 dev-kit 的 task 切分、`files` 并行判定、batch review、静态收尾或 runtime verification 规则。
- 运行中把现有 plan 从 `inline` 切换为 `subagent`，或反向切换。

## Testing decisions

用户在 2026-07-31 的设计确认中接受以下测试边界。

| Seam | What it verifies | Prior art |
|---|---|---|
| 可选包 manifest 与基础 dev-kit manifest | 可选包只暴露自己的 extension，基础包没有意外加载它；Pi 核心依赖按 package 规则声明 | `dev-kit/tests/pi-extension.test.js:51-58`、`dev-kit/tests/manifests.test.js` |
| 以假 `ExtensionAPI` 加载 extension 并执行已注册工具 | 工具名、schema、single/parallel/chain 互斥、profile 与工具权限的启动前校验 | `dev-kit/tests/pi-extension.test.js:17-39` 的 extension 加载方式 |
| 假 Pi 可执行文件输出 JSONL | CLI 参数、cwd、model、thinking、trust、流式消息、usage、错误聚合、chain `{previous}` 与输出截断 | Pi 官方示例的 JSON mode runner；仓库内无同类测试 |
| 可控延迟的多个假子进程 | parallel 同时运行不超过四个、最多八项、abort 终止未完成进程且保留完成结果 | 仓库内无同类测试 |
| Pi platform mapping 测试 | 没有工具时仍强制 inline；安装工具时使用本包 schema；禁止手动递归 Pi | `dev-kit/tests/platform-tools.test.js:35-44` |
| `node --test dev-kit/tests/*.test.js` | 新包没有破坏 hooks、Pi bootstrap、CLI、manifests 与其他 harness mapping | `dev-kit/README.md` 的测试入口 |

**不自动化的部分，以及为什么。** 不向真实 provider 发请求：绿灯只能证明子进程协议和边界，不能证明某个模型会正确完成 dev-kit prompt；模型质量由任务证据、两道静态审查和 runtime verification 判断。`read-only` 对 bash 的无副作用要求也不伪装成沙箱测试：自动化能证明写工具未暴露、system prompt 带约束，不能证明任意 shell 字符串绝无副作用，这一风险由 review 和文档明确承担。TUI 像素布局沿用官方 renderer，做静态审查而不新增截图基线。

## Open questions

无。

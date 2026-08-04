# Pi subagent 删除旧 single result 渲染兼容

> Status: Approved
> Owner: dev-kit
> Last updated: 2026-08-04

**Objective:** 删除尚未发布的旧 single result 包装解包逻辑，使 renderer 只把当前直接 `TaskResult` 形状解释为结构化任务结果。

**Hard invariant:** 当前直接 `TaskResult` 的 compact/expanded 输出、失败诊断、usage、model 和 model-visible fallback 不得回归；不得恢复 parallel/chain 或其他旧调用协议。

## Problem

1. **生产 renderer 仍保留旧 single result 兼容分支。** `dev-kit/.pi/extensions/subagent/lib/render.ts` 的 `resolveTaskResult()` 会把 `{ mode: "single", results: [taskResult] }` 解包为当前 `TaskResult`，但该形状从未发布，不存在迁移对象。
2. **测试仍把未发布兼容行为固定为契约。** `dev-kit/tests/pi-subagent-render.test.js` 的 `legacy completed single results remain readable and malformed legacy details fall back to model-visible content` 明确要求旧包装继续可读；用户在 2026-08-04 决定直接删除该测试且不保留旧包装的负向回归。
3. **上一 correction spec 允许继续保留旧 single fallback。** [`2026-08-04-pi-subagent-blank-optionals.md`](./2026-08-04-pi-subagent-blank-optionals.md) 将它列为可保留实现；本规格覆盖该项决定，不改变其中空白可选字段归一化或 R23 范围决定。

## Actors and user stories

1. 作为 **dev-kit 维护者**，我想删除未发布协议的兼容代码和契约测试，使首个发布版本只维护当前单任务 result 形状。

## Design decisions

| # | Decision | Basis and rejected option |
|---|---|---|
| 1 | renderer 只把直接 `TaskResult` 识别为结构化结果 | 用户要求清理未发布兼容。Rejected：继续解包 `{ mode: "single", results: [...] }`——为不存在的迁移对象保留永久分支 |
| 2 | 删除旧 single result 测试，不增加针对旧包装形状的负向回归 | 用户明确选择。Rejected：保留负向测试锁定旧包装走 fallback——仍让未发布形状进入长期测试契约 |
| 3 | 非 `TaskResult` details 继续走现有通用 model-visible fallback | renderer 仍需安全显示未知或畸形 tool result。Rejected：对未知 details 抛错或显示空结果——会丢失模型可见诊断文本 |
| 4 | 用静态审查确认兼容分支被删除，而不是新增旧形状测试 | 删除未发布形状本身是源码边界，静态审查能直接验证。Rejected：为可自动搜索的删除目标保留运行时兼容样例——与决定 2 冲突 |

## Rendering contract

当 tool result 的 `details` 是当前直接 `TaskResult` 时，renderer 继续产生现有 compact 或 expanded 任务展示。任务、消息、工具调用、输出、失败证据、usage 和 model 的选择与格式不变。

当 `details` 不是直接 `TaskResult` 时，renderer 不按 `mode`、`results` 或任何旧包装字段解释它，只显示 result 中现有的 model-visible 文本；没有可用文本时沿用现有无输出提示。不得为旧 single、parallel、chain、batch 或其他包装添加专用转换。

旧 single result 的整段兼容测试直接删除，不替换为旧形状的拒绝或 fallback 测试。静态审查必须确认生产 renderer 不再读取 `details.mode` 或 `details.results`，现有当前形状 renderer 测试继续覆盖发布契约。

## Compatibility

本包尚未发布，不承诺读取旧 single、parallel 或 chain details。历史规格保留为决策记录；从本规格起，[`2026-08-04-pi-subagent-blank-optionals.md`](./2026-08-04-pi-subagent-blank-optionals.md) 中“已实现的旧 single fallback 可以保留”不再适用。

该清理不改变新调用的输入失败边界：`tasks`、`chain`、调用级 `tools` 和未知字段仍在启动前拒绝，不做兼容转换。

## Out of scope

- 改变当前直接 `TaskResult` 的字段、renderer 布局、截断、failure 或 usage 行为。
- 为旧包装添加拒绝消息、迁移器、转换器或负向回归测试。
- 修改空白 `model`、`thinking`、`cwd` 的继承修复。
- 修改 scheduler、profile、tool resolution、递归防护、trust、abort 或 child lifecycle。
- 清理与 renderer compatibility 无关的既存 warning 或 standing finding。

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| 当前直接 `TaskResult` renderer 测试 | compact/expanded 输出、失败证据和完整 model-visible output 继续工作 | `dev-kit/tests/pi-subagent-render.test.js` 的当前 single-task tests |
| 静态 diff/source review | 旧测试整段删除，生产 renderer 不读取旧包装的 `mode/results` | `resolveTaskResult()` 与 renderer test diff |
| 完整仓库测试 | 清理没有破坏 extension 注册、单任务执行、文档映射或其他 dev-kit 功能 | `node --test dev-kit/tests/*.test.js` |
| Provider-free renderer runtime probe | 真实 Pi 注册的当前直接 `TaskResult` 仍可由 renderer 展示，不触发 provider/model turn | 现有 scratch-scoped Pi extension harness |

旧 single 包装不进入最终自动化或 runtime probe；这是用户选择的删除边界。静态审查负责确认没有兼容生产分支或契约测试残留。

## Relevant links

- [`2026-08-04-pi-subagent-single-dispatch.md`](./2026-08-04-pi-subagent-single-dispatch.md)
- [`2026-08-04-pi-subagent-blank-optionals.md`](./2026-08-04-pi-subagent-blank-optionals.md)

## Open questions

无。

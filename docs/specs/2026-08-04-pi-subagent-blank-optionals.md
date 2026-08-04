# Pi subagent 空可选参数归一化

> Status: Approved
> Owner: dev-kit
> Last updated: 2026-08-04

**Objective:** 让真实 Pi 父模型生成空白 `model`、`thinking` 或 `cwd` 时与省略这些可选字段产生相同的继承行为，使只有 `task/profile` 有效内容的单任务调用能够启动子进程。

**Hard invariant:** `task` 和 `profile` 继续严格必填，非空但非法的 model、thinking、cwd 继续在启动子进程前失败；不得恢复 `tasks`、`chain`、调用级 `tools` 或旧结果展示兼容。

## Problem

1. **真实父模型会填充空可选字段，令最小调用无法启动。** 运行时报告 `e2e/scratch/2026-08-04-pi-subagent-single-dispatch/report.md` 的 R22 观察到两次真实 tool call 都把本应省略的 `model`、`thinking`、`cwd` 写成空字符串；当前 model 校验在 `dev-kit/.pi/extensions/subagent/lib/validation.ts:52-59` 将空字符串判为非法 `provider/model`，所以请求在子进程启动前失败。用户在 2026-08-04 要求直接修复这一项。

2. **未发布代码不需要承担旧 parallel/chain result 展示兼容。** 前一规格要求已完成旧 session 保持可读，但运行时 R23 只观察到旧 single 可读。用户确认该包尚未发布，决定不实现旧 parallel/chain renderer 兼容，避免为未发布传输形状保留生产分支。

## Actors and user stories

1. 作为**调用 `subagent` 的 Pi 父模型**，我想让空白可选字段按省略处理，这样模型只正确提供 `task/profile` 时不会因序列化噪声阻止派发。
2. 作为**维护者**，我想继续拒绝有内容但非法的配置值，这样归一化不会隐藏模型 ID、thinking level 或工作目录错误。
3. 作为**尚未发布包的维护者**，我想删除旧结果展示兼容承诺，这样当前实现只维护正式发布时的单任务 result 形状。

## Design decisions

| # | Decision | Basis and rejected option |
|---|---|---|
| 1 | `model`、`thinking`、`cwd` 为字符串且 trim 后为空时，在校验前归一化为未提供 | 用户批准；真实 Pi 模型已观察到生成空字符串。Rejected：继续报错——最小真实调用不可用；Rejected：只兼容 `""` 不兼容空白——同类序列化噪声产生不一致结果 |
| 2 | 归一化后的字段使用现有继承规则 | 空 model/thinking 分别继承父会话，空 cwd 使用父 cwd，不引入新默认来源。Rejected：保存空值到子进程——CLI 会收到无效配置 |
| 3 | 非空非法值保持启动前失败 | 本轮只容忍“没有值”的表示，不放宽合法值集合。Rejected：任意非法值都 fallback——掩盖真实调用错误和证据 |
| 4 | `task` 和 `profile` 不参与空值归一化 | 二者定义任务与权限，缺失时没有安全默认。Rejected：为空时推断——会制造未授权任务或 profile |
| 5 | 不实现旧 parallel/chain session 展示兼容 | 用户确认尚未发布，无迁移对象。Rejected：恢复旧 renderer 分支——为未发布 API 增加永久维护面 |

## Parameter normalization

工具收到对象后，先确认只有 `task/profile/model/thinking/cwd` 五个公开字段，再对三个可选字符串做归一化。`model`、`thinking` 或 `cwd` 的值 trim 后为空时，后续校验与执行必须像字段不存在一样处理；最终 resolved request 不保留空字符串。

归一化后，model 继承父会话当前 `provider/model`，thinking 继承父会话 thinking level，cwd 解析为父会话 cwd。显式的合法非空值继续覆盖父值。

值非空时沿用现有失败行为：model 必须是合法 `provider/model`，thinking 必须属于 Pi 支持的 level，cwd 必须解析为存在的目录。失败必须发生在任何子进程启动之前，并指出对应字段。

`task` trim 后为空仍失败；`profile` 仍只能是 `read-only`、`write` 或 `general`。未知字段以及 `tasks`、`chain`、`tools` 仍失败，不因本轮归一化被忽略。

## Compatibility and documentation

本规格撤回 [`2026-08-04-pi-subagent-single-dispatch.md`](./2026-08-04-pi-subagent-single-dispatch.md) 中“已保存 session 中已经完成的旧工具结果保持可读”对旧 parallel/chain details 的要求。已实现的旧 single fallback 可以保留，但不是发布契约；不得新增 parallel/chain renderer、类型或测试分支。

公开 schema 仍只有五个字段。包内调用文档应说明省略或留空可选字段都会继承父会话值，避免调用者依赖空字符串被传给子 CLI。

## Out of scope

- 恢复旧 parallel/chain result 的逐任务展示。
- 恢复 `tasks`、`chain`、`{previous}`、并发池或调用级 `tools`。
- 修改 profile 工具集合、递归防护、trust、abort、failure 或 renderer 的当前单任务行为。
- 修复静态审查记录的逗号/空白工具名、超大 call card 或 `MODULE_TYPELESS_PACKAGE_JSON` warning。
- 调整父模型本身的 tool-call 序列化策略。

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| 注册工具的真实 execute seam | 空白 model/thinking/cwd 与省略字段解析成相同的 model、thinking、cwd 和子 CLI 参数 | `dev-kit/tests/pi-subagent-single.test.js` 的 fake-Pi capture |
| 启动前校验 | 非空非法 model/thinking/cwd、空 task、非法 profile 和旧字段仍不启动子进程 | `dev-kit/tests/pi-subagent-single.test.js` 的 invalid cases |
| 包内 README 与映射断言 | 调用方知道空白可选字段继承父值，且文档不承诺旧 parallel/chain 展示兼容 | `dev-kit/tests/platform-tools.test.js` |
| Provider-free runtime probe | 通过真实 Pi extension/child lifecycle 直接提交空白字段，观察继承与子进程启动，不触发 agent/model/provider turn | 前一运行时报告中的 intercepted-child harness |
| 仓库门禁 | 变更不破坏其他 package、hook、renderer、CLI 和平台映射 | `node --test dev-kit/tests/*.test.js` |

不向任何真实 provider 发请求；runtime verifier 必须在 agent/model turn 前拦截子进程。父模型是否继续生成空字段不属于本包可自动修复的行为，本轮只验证这些字段不再阻止派发。

## Open questions

无。

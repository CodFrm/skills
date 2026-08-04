# dev-kit Pi subagent

给 dev-kit 单独安装的 Pi package。它注册 `subagent` 工具，每次调用启动一个新的、无 session 持久化的 Pi JSON 子进程；基础 `dev-kit/package.json` 不引用本包。

## 安装与移除

从包含本仓库的 checkout 安装本地路径：

```bash
pi install /path/to/skills/dev-kit/.pi/extensions/subagent
```

执行 `/reload` 后检查当前工具列表。只有真实出现 `subagent` 时，dev-kit 的 plan ready 闸门才提供 `subagent`；未安装、禁用、移除或尚未 reload 时只提供 `inline`。

```bash
pi list
pi remove <pi list 中显示的本地 source>
```

移除后再次执行 `/reload`。安装和移除都不创建、复制或清理 `~/.pi/agent/agents/*.md`、项目 `.pi/agents/*.md` 或模型映射文件。

## 调用契约

每次调用只接受以下字段：

```ts
subagent({
  task: string,
  profile: "read-only" | "write" | "general",
  model?: string,
  thinking?: string,
  cwd?: string
})
```

`task` 和 `profile` 必填；每次成功调用对应一个新的子进程和一个任务结果。`tasks`、`chain`、`tools` 以及其他未知字段都会在启动前拒绝，不做兼容转换。`model` 必须是调用时解析出的真实 `provider/model`；plan 里的 `cheap`、`mid`、`strong` 由主会话在派发时解析。

## 编排边界

主会话默认串行处理依赖；只有 [`executing-plans`](../../../skills/executing-plans/SKILL.md#parallel-is-proved-not-assumed) 针对当前精确 HEAD 批准并行派发时，主会话才在同一 assistant message 中发送多个并行 sibling `subagent` calls。每个调用独立启动、流式更新、失败和返回；extension 不读取 plan、不判断依赖、不保留 scheduler 或 queue、不设置并发上限、不聚合 sibling results，也不写 `.dev-kit/plans/*.yaml`。

前一个调用返回后，主会话负责判断是否继续，并为串行依赖形成新的完整 task；工具不会机械传递前序输出或自行选择后续步骤。

## Profiles and tool resolution

| Profile | 子进程工具 | 用途与约束 |
|---|---|---|
| `read-only` | 固定 `read,bash,grep,find,ls` | 调查、静态审查和验证；prompt 要求不得修改文件、仓库状态或外部系统，bash 只做只读检查 |
| `write` | 固定 `read,bash,edit,write,grep,find,ls` | 实现、review-and-fix 和不需要项目自定义工具的落盘任务；修改范围由 task prompt 与项目规则决定 |
| `general` | 父会话当前 active tools 去重后所得集合，并无条件排除精确名称 `subagent`；过滤后为空时以无工具模式启动 | 需要父会话已加载的 browser、artifact 或其他 extension 工具时使用；不从 registered tools 扩大集合 |

这些 profile 是工具边界与行为约束，不是 OS sandbox；子进程仍以当前用户权限运行。若父 active tool 在子进程中不可用，调用失败并返回 Pi 诊断，不静默删除能力或 fallback 到更宽集合。

## Recursion boundary

递归由三层共同阻断：任何解析出的子工具集合都排除精确名称 `subagent`；带有包内部 child registration marker 的子 Pi 不注册 `subagent`；子进程 system prompt 明确它只执行一个已派发 task，不得调用或委派 `subagent`、向用户提问或接管整份 plan，并服从 `using-dev-kit` 的 `SUBAGENT-STOP`。

## Model, working directory and trust

未提供或留空 `model`、`thinking` 时继承父会话当前值；显式非空 model 不存在、未认证或不能启动时保留原始失败诊断，不静默 fallback。未提供或留空 `cwd` 时使用父会话 cwd；提供非空路径时相对父 cwd 解析并在启动前确认是目录。父项目已信任且 cwd 等于父 cwd 或位于其下时使用一次性 approval，否则使用一次性拒绝。每个任务都启动独立的 Pi JSON/print 子进程并关闭 session 持久化。

## 输出与失败

子进程 JSONL 事件继续流式进入当前工具调用。结果只对应一个 task，保留 progress、最终输出、turns、token/cache、cost、context、model、exit code、stop reason、错误消息、stderr、最后输出、signal 和 abort 证据。父调用 abort 只终止当前调用的子进程，超时后强制结束；不会取消或重试 sibling calls。父会话负责机械证据检查、plan 状态和 review 边界；子 agent 的结果是报告，不是状态转换许可。

## 测试

从仓库根运行：

```bash
node --test dev-kit/tests/*.test.js
```

测试使用假 Pi JSONL 子进程，不调用真实 provider。实现来源与许可证见 [NOTICE.md](./NOTICE.md)。

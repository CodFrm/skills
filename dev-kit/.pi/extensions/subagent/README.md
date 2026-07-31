# dev-kit Pi subagent

给 dev-kit 单独安装的 Pi package。它注册 `subagent` 工具，每个任务启动一个无 session 持久化的 Pi JSON 子进程；基础 `dev-kit/package.json` 不引用本包。

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

每次调用只能选择一种模式：

- single：直接传一个任务的字段；
- parallel：传 `tasks`，最多八项、同时最多四个进程；
- chain：传 `chain`，后一步可在 `task` 中用 `{previous}` 接收前一步的成功输出，首个失败会停止链。

每个任务都需要：

| 字段 | 用法 |
|---|---|
| `task` | 完整、可独立执行的 prompt |
| `profile` | 必填：`write` 或 `read-only` |
| `model` | 可选的真实 `provider/model`；省略时继承父会话 |
| `thinking` | 可选 Pi thinking level；省略时继承父会话 |
| `tools` | 可选 allowlist；不能包含 `subagent` |
| `cwd` | 可选绝对路径，或相对父会话 cwd 的目录 |

single 示例：

```json
{
  "task": "Implement task 2 from the approved plan and return commit plus test evidence.",
  "profile": "write",
  "model": "provider/model",
  "thinking": "high",
  "cwd": "/path/to/worktree"
}
```

parallel 与 chain 把同样的任务对象放进对应数组。plan 继续只保存 `cheap / mid / strong`；主会话必须在派发前根据当前环境选择实际模型，本包不推断强弱、不静默 fallback，也不保存跨会话配置。

## 权限与 trust

`write` 默认开放 `read,bash,edit,write,grep,find,ls`，显式 `tools` 可以使用当前 Pi 已加载的其他工具，但不能使用 `subagent`。`read-only` 默认开放 `read,bash,grep,find,ls`，显式列表只能删减；追加 system prompt 要求 bash 只做 `git diff`、`git show`、`git log` 等只读检查。

这些 profile 是模型的工具边界与行为约束，不是 OS sandbox。extension 与子进程仍以当前用户权限运行。

父会话已信任项目、且任务 cwd 等于父 cwd 或位于其下时，子进程使用本次运行的 `--approve`；父会话未信任，或 cwd 位于父 cwd 外时使用 `--no-approve`。用户级 extension 仍按 Pi 规则加载，任何子任务都不得再次派发 `subagent`。

## 输出与失败

JSONL 消息会流式送入工具更新。折叠与 Ctrl+O 展开视图显示任务、工具调用、turns、token/cache、cost、context 和模型；parallel 逐项保留成功或失败结果。每项送回父模型的文本最多 50KB，完整消息保留在 tool details。

非零退出、`stopReason: error`、abort 与启动失败会保留 exit code、stop reason、错误消息、stderr 和最后输出。父会话仍负责检查证据、写 plan、做 review 与判定完成。

## 测试

从仓库根运行：

```bash
node --test dev-kit/tests/*.test.js
```

测试使用假 Pi JSONL 子进程，不调用真实 provider。实现来源与许可证见 [NOTICE.md](./NOTICE.md)。

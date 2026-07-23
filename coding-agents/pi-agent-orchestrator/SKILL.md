---
name: "pi-agent-orchestrator"
description: "可靠派发、监控、恢复并验收 Pi Coding Agent 编码任务"
---

# Pi Agent Orchestrator

把 Pi Coding Agent 当作受控执行器，而不是结果裁判。由当前助手负责界定范围、选择权限、监控真实事件、独立验收和准确归因。

本 Skill 已按 `@earendil-works/pi-coding-agent` 0.81.1 验证。版本明显变化时，先检查本机 `pi --help` 和包内文档。

## 启动前

1. 确认 `command -v pi`、`pi --version`，必要时用 `pi --list-models` 检查模型；不要打印认证文件或 API Key。
2. 明确目标工作目录并先检查：仓库状态、当前分支、已有改动、项目指令文件和可运行的验收命令。
3. 判断任务模式：
   - **research**：只读研究、代码审查、定位问题、制定方案。
   - **write**：允许修改文件和运行项目命令。
   - **interactive**：只有用户需要实时操作 Pi TUI 时使用，并给执行工具分配 PTY。
4. 明确可写路径、禁止触碰内容、是否允许联网、是否允许安装依赖、是否允许执行测试。
5. 默认禁止 commit、push、发布、部署、删除、修改系统配置和读取工作目录外敏感文件；仅在用户明确授权后放开对应动作。

Pi 的 project trust、`--no-approve` 和工具 allowlist 都不是操作系统沙箱。面对不可信仓库或高风险命令，使用隔离副本/容器/受限执行环境，不能只靠提示词。

## 构造任务

不要把整段聊天记录、无关日志或大量源码直接塞进提示词。只提供完成任务所需的目标、证据入口和约束，避免上下文溢出。

使用 `references/task-prompt.md` 的结构，至少写明：

- Objective
- Working directory
- Mode and write scope
- Constraints and forbidden actions
- Required verification
- Deliverable format

明确要求 Pi 在结尾报告：结论或改动、涉及文件、执行过的命令、测试结果、失败项和遗留风险。

## 运行

长任务优先使用本 Skill 的执行器：

```bash
scripts/pi-run.sh research /absolute/repo task-name /absolute/prompt.md /absolute/run-dir
scripts/pi-run.sh write    /absolute/repo task-name /absolute/prompt.md /absolute/run-dir
```

通过 OpenClaw 执行时：

- 为长任务启用后台执行和可靠完成唤醒；保存执行会话 ID。
- 运行目录放在工作区日志/临时目录，不要提交进 Git。
- `events.jsonl` 是原始 Pi JSON 事件，`stderr.log` 是诊断日志，`exit-code` 是进程退出码。
- 执行器默认禁用项目扩展、Pi Skills 和提示模板，使用 `--no-approve`，并按模式限制工具。
- 若任务确实需要可信的项目本地扩展或 Skill，先审查内容，再显式改用直接 Pi 命令；不要静默放开。

快速、一次性只读任务可以直接运行：

```bash
pi --mode json --no-session --no-approve \
  --no-extensions --no-skills --no-prompt-templates \
  --tools read,grep,find,ls "任务提示"
```

完整模式和会话命令见 `references/pi-modes-and-sessions.md`。

## 真实进度

长任务至少每 5 分钟检查一次真实状态，前提是当前运行环境已配置可靠的定时唤醒或状态检查；没有该机制时，不要承诺自动汇报。

进度必须来自以下证据：

- 新的 Pi JSON 事件；
- 最近完成/失败的工具调用；
- 新产生的文件或 Git diff；
- 测试、Lint、构建进程状态；
- 重试、压缩、错误或 `agent_settled` 事件。

可随时生成脱敏摘要：

```bash
python3 scripts/pi-events.py summary /absolute/run-dir/events.jsonl
```

摘要工具不会输出思考内容、用户提示、工具参数或工具结果。不要只说“还在运行”；应说明最近完成了什么、当前在做什么、是否出现异常。若没有新事件，明确说“本周期无新事件”。

## 中断与恢复

- 进程无新事件且资源状态异常：先读日志，再决定继续等待、发送中断或终止。
- 收到用户暂停/停止指令：立即停止对应进程，不再自动续跑。
- 超时或被中断后，保留 run 目录和 Pi session ID；先总结已完成工作和仓库状态。
- 需要继续同一上下文时，使用事件首行中的 session ID：

```bash
pi --mode json --session SESSION_ID --no-approve \
  --no-extensions --no-skills --no-prompt-templates \
  --tools read,bash,edit,write,grep,find,ls "精简的继续指令"
```

- 上下文已污染、目标变化大或持续失败时，开新 session，并只携带已验证的摘要、diff 和失败证据。
- 不使用会话分享功能，除非用户明确要求且已检查提示词、代码、路径和凭据风险。

## 完成验收

Pi 报告完成或进程退出不等于任务完成。当前助手必须独立完成最小验收：

1. 检查退出码、事件摘要、错误和 `agent_settled`。
2. 检查 `git status --short`、`git diff --stat` 和相关 diff；确认没有越界修改、敏感文件或意外删除。
3. 按项目实际情况运行最小相关测试，再运行适用的 Lint、类型检查、构建或更完整测试。
4. 检查任务要求逐项满足；无法验证的项目明确标记 `[未验证]`，失败项标记 `[失败]`，缺输入则标记 `[阻塞]`。
5. 对破坏性、外部或隐私敏感操作保持确认边界，不能因 Pi 建议而跳过授权。

最终汇报必须区分：

- **Pi 产出**：Pi 的分析、改动和自报测试。
- **小机复核**：实际检查的 diff、命令和独立测试结果。
- **未验证/阻塞**：缺少环境、权限、依赖或用户决策的内容。

不要把 Pi 的工作冒充 Codex 或当前助手亲自完成，也不要只转述 Pi 的成功声明。

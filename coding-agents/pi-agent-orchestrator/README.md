# Pi Agent Orchestrator

可靠派发、监控、恢复并验收 [Pi Coding Agent](https://github.com/badlogic/pi-mono) 编码任务。

## 解决什么问题

直接启动 Coding Agent 很容易出现几类问题：任务范围模糊、权限放得过宽、后台运行后没有可靠进度、Agent 自报成功却没有独立验收，以及失败后反复从头开始。本 Skill 把 Pi 当作受控执行器，由上层助手负责范围、权限、监控、恢复和最终验收。

## 核心能力

- 区分 `research`、`write` 和交互式任务模式。
- 通过工具白名单、任务写入范围和禁止动作限制权限。
- 使用结构化任务模板，减少无关上下文和敏感信息暴露。
- 保存 Pi JSONL 事件、诊断日志和退出码，并生成脱敏进度摘要。
- 根据 session ID 恢复中断任务，处理重试、压缩和上下文漂移。
- 独立检查 Git diff，并执行相关测试、Lint、类型检查或构建。
- 最终报告区分 Pi 产出、监督助手复核以及未验证或阻塞事项。

## 目录

- `SKILL.md`：完整编排流程和安全边界。
- `references/task-prompt.md`：任务提示与继续会话模板。
- `references/pi-modes-and-sessions.md`：Pi 模式、权限、事件和会话策略。
- `scripts/pi-run.sh`：受控启动 research/write 任务并保存运行证据。
- `scripts/pi-events.py`：记录和脱敏汇总 Pi JSONL 事件。

## 安装

```text
帮我安装这个 Skill：https://github.com/CodFrm/skills/tree/main/coding-agents/pi-agent-orchestrator
```

也可以克隆仓库后建立软链接：

```bash
ln -s "$(pwd)/coding-agents/pi-agent-orchestrator" ~/.claude/skills/pi-agent-orchestrator
ln -s "$(pwd)/coding-agents/pi-agent-orchestrator" ~/.codex/skills/pi-agent-orchestrator
```

## 兼容性

当前流程按 `@earendil-works/pi-coding-agent` 0.81.1 验证。版本明显变化时，应先检查本机 `pi --help` 和对应版本文档。

Pi 的 project trust、`--no-approve` 与工具白名单不是操作系统沙箱。对于不可信仓库或高风险命令，仍应使用隔离副本、容器或其他受限环境。

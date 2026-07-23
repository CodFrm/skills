# Coding Agent Skills

这组 Skills 用于可靠地编排、约束和验收编码智能体。重点不是替代智能体自身能力，而是建立清晰的任务范围、权限边界、真实进度证据、失败恢复和独立验收流程。

## 包含内容

- [Pi Agent Orchestrator](./pi-agent-orchestrator/)：受控派发、监控、恢复并验收 Pi Coding Agent 编码任务。

## 安装

将对应仓库链接交给支持安装 Skills 的智能体。例如：

```text
帮我安装这个 Skill：https://github.com/CodFrm/skills/tree/main/coding-agents/pi-agent-orchestrator
```

## 使用边界

- Coding Agent 是受控执行器，不是最终结果裁判。
- 默认不允许提交、推送、发布、部署、删除、修改系统配置或访问凭据。
- 长任务进度必须来自日志、工具调用、文件变更或测试状态等真实证据。
- Agent 报告完成后仍需检查 diff，并独立执行最小相关测试。

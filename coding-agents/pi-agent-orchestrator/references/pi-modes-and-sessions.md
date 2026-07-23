# Pi 模式、权限和会话

基线：`@earendil-works/pi-coding-agent` 0.81.1。以本机 `pi --help` 和安装包文档为准。

## 四种运行方式

- **Interactive**：终端 TUI，适合用户实时操作；执行工具需启用 PTY。
- **Print / JSON**：OpenClaw 常规编排首选。JSONL 可记录会话、消息、工具调用、压缩、重试和 settled 状态。
- **RPC**：适合开发长期集成或自定义前端，不是普通一次性任务的默认选择。
- **SDK**：适合 Node/TypeScript 应用内嵌 Pi，不应为普通仓库任务额外引入代码。

## 默认权限模式

### research

```bash
--no-approve --no-extensions --no-skills --no-prompt-templates \
--tools read,grep,find,ls
```

适合只读分析、代码审查和方案设计。它降低误改风险，但不是 OS 级只读沙箱；若仓库不可信，仍需隔离。

### write

```bash
--no-approve --no-extensions --no-skills --no-prompt-templates \
--tools read,bash,edit,write,grep,find,ls
```

Pi 的 `bash` 可以产生工作目录外副作用，因此必须通过任务范围、隔离环境和独立 diff 验收约束。需要联网、安装依赖或访问额外目录时应单独授权。

### 项目上下文

Pi 默认可读取 AGENTS.md 等上下文文件。这有助于遵循仓库规范，但也会增加上下文量，并可能引入不可信指令。对不可信或体量异常的项目使用 `--no-context-files`，改为在任务提示中提供经审查的必要规则。

## 会话策略

- 快速一次性研究：使用 `--no-session`，避免留下不必要会话。
- 长编码任务：保留 session，并用稳定、无敏感信息的 `--name`。
- JSON 首个 `session` 事件包含 session ID；恢复时优先使用显式 ID，不依赖“最近会话”。
- 同一目标的小步修复可以恢复；目标大改、上下文污染或连续失败则新开会话。
- 恢复时仍重复安全 flags 和工具 allowlist，不假设旧会话权限就是当前要求。
- 不把同一 session 并发交给多个执行者。
- 不公开分享 session，除非用户明确授权并完成敏感信息审查。

## 自动压缩

Pi 会根据配置自动压缩长会话。压缩是继续工作的机制，不是事实保真保证：

- 关键约束、验收结果和未完成项应写入外部 run 日志或继续提示；
- 压缩后检查目标、范围和失败证据是否仍准确；
- 若多次压缩后行为漂移，创建新 session，只传递已验证摘要和当前 diff。

## 事件判断

- `tool_execution_start/end`：实际工具进度；不要打印工具参数和结果，以免泄密。
- `message_end`：助手阶段性或最终消息；`toolUse` 不代表任务完成。
- `agent_end`：本轮结束，可能仍计划 retry。
- `agent_settled`：代理已稳定停止，但仍需检查退出码和验收结果。
- 压缩、retry、error 事件：必须在进度与最终报告中说明。

## 失败恢复

1. 先保存 `events.jsonl`、`stderr.log`、退出码和仓库状态。
2. 区分：模型/API 错误、工具失败、测试失败、上下文溢出、权限/环境问题。
3. 对可复现的小错误，用精简继续指令恢复；不要重新灌入全部历史。
4. 对上下文溢出或任务漂移，开新 session，附验证过的状态摘要。
5. 对破坏性或越界行为立即停止，检查 diff 和外部副作用，再决定是否回滚；任何回滚前都要保护用户已有改动。

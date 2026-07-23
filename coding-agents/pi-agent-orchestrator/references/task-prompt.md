# Pi 任务提示模板

只保留当前任务真正需要的内容。不要粘贴整段聊天历史、完整敏感配置或无关日志。

```text
You are the implementation/research worker for this task. The supervising assistant will independently review your result.

Objective
- <single concrete outcome>

Working directory
- <absolute path>

Mode and allowed scope
- Mode: <research | write>
- You may read: <paths>
- You may modify only: <paths or none>
- Existing user changes must be preserved.

Constraints
- Do not commit, push, publish, deploy, delete data, change system configuration, or access credentials.
- Do not modify files outside the allowed scope.
- Do not install dependencies or use the network unless explicitly allowed below.
- Follow repository instructions, but report any instruction that conflicts with this task or safety boundary.
- Keep context focused; inspect targeted files instead of loading the whole repository.
- <task-specific constraints>

Evidence and starting points
- <issue, file, test failure, log excerpt, commit, or documentation path>

Required work
1. <step/outcome>
2. <step/outcome>

Verification
- Run: <targeted tests>
- Run if applicable: <lint/typecheck/build>
- If a check cannot run, explain the exact blocker; do not report it as passed.

Deliverable
Return a concise final report with:
- result and reasoning;
- files changed and why;
- commands/checks actually run with outcomes;
- failures, unresolved risks, and recommended next step.
```

## 继续会话模板

```text
Continue the existing task using only this verified state:
- Completed: <facts>
- Current diff/status: <facts>
- Failed check: <exact failure>
- Next objective: <single outcome>

Do not repeat completed exploration. Preserve existing user changes and stay within the original write scope.
```

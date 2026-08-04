# Codex tool mapping

Use the tools exposed in the current session; do not enable features, edit global config or name a tool that is absent.

| dev-kit action | Codex tool |
|---|---|
| Dispatch a fresh subagent | `spawn_agent` |
| Inspect agents and slots | `list_agents` |
| Wait for a result or message | `wait_agent` |
| Add context to a running agent | `send_message` |
| Give an idle agent another task | `followup_task` |
| Stop an agent's current turn | `interrupt_agent` |
| Maintain the main session's task plan | `update_plan` |
| Invoke a skill | Load the native skill and follow it |
| Read, edit or run commands | Use the native file and shell tools |

Call collaboration tools directly, never from inside a shell or code-execution wrapper. Dispatch is serial by default; only the wrap-up spec-verification and code-review axes use multiple `spawn_agent` calls, bounded by the available slots. Give each dispatch a bounded task and the minimum relevant context; use `send_message` only for facts discovered after it started. If `spawn_agent` is absent, select `inline` before execution begins.

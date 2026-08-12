# Claude Code tool mapping

Use the tools exposed by the running Claude Code version; where a build labels `Task` as `Agent`, use that exposed name without changing the workflow.

| dev-kit action | Claude Code tool |
|---|---|
| Dispatch a fresh subagent | `Task` |
| Wait for a foreground subagent | Read the `Task` result |
| Wait for a background subagent | `TaskOutput` |
| Continue an existing subagent | Resume it through `Task` with its agent id |
| Maintain the main session's task plan | `TodoWrite` |
| Invoke a skill | `Skill` |
| Read, edit or run commands | `Read`, `Edit`, `Write`, `Bash` |

Resolve `subagent_type` and model from the agents the current installation offers; do not invent either. Start every member of an `executing-plans` safe implementation batch in the background before waiting; dispatch everything else serially, including both wrap-up axes. If no native `Task` or `Agent` tool is exposed, select `inline` before execution begins.

# Pi tool mapping

This mapping is verified against `@earendil-works/pi-coding-agent` 0.81.1. On another version, inspect `pi --version`, `pi --help` and the exposed tool list before using it.

| dev-kit action | Pi tool |
|---|---|
| Read a file | `read` |
| Run a command | `bash` |
| Change an existing file | `edit` |
| Create or replace a file | `write` |
| Search and enumerate | `grep`, `find`, `ls` |
| Maintain execution state | The main session writes `.dev-kit/plans/*.yaml` |
| Dispatch or wait for a native subagent | Not available in the base tool set |

The verified base allowlist is `read,bash,edit,write,grep,find,ls`; choose `inline` when Pi itself runs dev-kit. Do not recursively launch another `pi` process and call it a subagent.

An outer Claude, Codex or other orchestrator may run Pi as an external executor through `pi-agent-orchestrator`. That is a separate process with its own permissions, events and independent acceptance; it does not satisfy a stage that specifically requires a native fresh-context reviewer unless the orchestrator enforces the same isolation and evidence contract. If a reviewed Pi extension exposes a real delegation tool, map its actual schema for that session rather than assuming a name from another harness.

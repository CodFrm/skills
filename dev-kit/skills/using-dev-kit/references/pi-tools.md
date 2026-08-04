# Pi tool mapping

Pi registers package skills by their frontmatter names without the `dev-kit:` namespace. When an instruction says `dev-kit:<name>`, use the native skill `<name>`: load the `SKILL.md` path Pi exposes for it with `read`; a human can force the same load with `/skill:<name>`.

| dev-kit action | Pi tool |
|---|---|
| Invoke `dev-kit:<name>` | Native skill `<name>`; load its exposed `SKILL.md` with `read` |
| Read a file | `read` |
| Run a command | `bash` |
| Change an existing file | `edit` |
| Create or replace a file | `write` |
| Search and enumerate | `grep`, `find`, `ls` |
| Maintain execution state | The main session writes `.dev-kit/plans/*.yaml` |
| Dispatch or wait for a native subagent | Not available in the base tool set; use the optional mapping below only when loaded |

The base allowlist is `read,bash,edit,write,grep,find,ls`. Do not recursively launch another `pi` process and call it a subagent.

## Optional dev-kit subagent

Before a plan ready gate, inspect the current session's actual tool list for the exact tool name `subagent`:

- When `subagent` is absent, offer only `inline`.
- When `subagent` is present, offer `subagent` and `inline`; dispatch and wait through that tool rather than shell-launching Pi.

Each `subagent` call is one fresh child and accepts exactly `task`, `profile`, `model`, `thinking`, and `cwd`; `task` and `profile` are required. The fields `tasks`, `chain`, and `tools` are rejected with no compatibility conversion. A task result is returned directly.

The main session owns serial dependencies. After a call returns, it decides whether to send the next complete task. When the plan's gate has proved the four boundaries against the exact current HEAD, the main session may send multiple sibling `subagent` calls in one assistant message; Pi runs those independent calls concurrently. The extension has no scheduler or queue, and does not aggregate sibling results or write `.dev-kit/plans/*.yaml`.

## Profiles and tool resolution

- `read-only` uses the fixed `read,bash,grep,find,ls` set and a prompt forbidding file, repository-state, and external-system changes. It is not an OS sandbox.
- `write` uses the fixed `read,bash,edit,write,grep,find,ls` set; the task prompt and project rules own the write boundary.
- `general` inherits the parent Pi active tools, deduplicated while preserving first occurrence, and excludes the exact name `subagent`. It does not expand from all registered tools; an unavailable inherited tool fails with Pi diagnostics rather than being silently removed or replaced.

## Recursion boundary

Recursion is blocked at three layers: the resolved child tool set excludes `subagent`; a child-registration marker prevents the extension from registering `subagent` in the child; and the child system prompt says it executes one dispatched task, may not call or delegate `subagent`, ask the user questions, or take over the plan, and must obey `using-dev-kit`'s `SUBAGENT-STOP`. Even if the parent's active tools include `subagent`, the child has no recursive entry point.

## Model, working directory and trust

Resolve `cheap`, `mid`, or `strong` plan tiers to a real `provider/model` in the main session at dispatch; the package does not infer or persist that mapping. Omitted `model` and `thinking` inherit the parent values. Omitted `cwd` uses the parent cwd; a supplied path is resolved from it and must be a directory. A trusted in-tree cwd uses one-time approval; an untrusted or out-of-tree cwd uses one-time rejection. Each task uses an independent Pi JSON/print process with no session persistence.

JSONL progress continues to stream into the current call. Single-task output and failure evidence retain the task, progress, final output, usage, model, exit code, stop reason, error, stderr, signal, and abort details. The main session owns mechanical evidence checks, plan state, and review boundaries; a child result is a report, not permission to change the plan.

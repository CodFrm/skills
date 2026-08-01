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

Every dispatched task requires `profile`: use `write` for implementation, review-and-fix, and runtime verification; use `read-only` for investigation and static reviews. Resolve the plan's relative model tier against models available now, then pass a real `provider/model`; do not persist a tier mapping or let the package infer model strength. Use single by default, parallel only after `executing-plans` records its four-boundary evidence against the exact current HEAD, and chain only when the next task consumes `{previous}`. A task's explicit `tools` must stay within its profile and must not include `subagent`.

The main session owns task selection, routing, mechanical SHA checks, verification acceptance and every plan state write; [`executing-plans`' review boundary](../../executing-plans/SKILL.md#executing-a-plan) does not change on Pi. A child completion is a report, not permission to change `.dev-kit/plans/*.yaml`.

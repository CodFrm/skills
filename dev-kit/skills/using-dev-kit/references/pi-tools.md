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
| Dispatch or wait for a native subagent | Not available in the base tool set |

The base allowlist is `read,bash,edit,write,grep,find,ls`; choose `inline` when Pi itself runs dev-kit. Do not recursively launch another `pi` process and call it a subagent. If the current session exposes an installed delegation tool, inspect and map its actual schema instead of assuming a name from another harness.

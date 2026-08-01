# Fill templates from project facts

Every symbol, path, command and code shape in generated docs must come from tracked project state.

## Method

1. Locate the project's single entry point for the concept.
2. Lift a representative real call/shape without changing its API. Prefer project wrappers over underlying libraries.
3. Verify symbols with `git grep`, paths with `git ls-files`, and run every documented command.

When a selected convention does not exist yet, build it and run it first, then document the landed form. If it is neither present nor selected for this round, delete the template section. Never invent a plausible example or leave a TODO skeleton.

## Lookup map

| Target | Source |
|---|---|
| Commands/package manager | package scripts, Make targets, lockfile; run each command |
| Stack/module/version | `go.mod`, `package.json`, `pyproject.toml`, equivalent manifests |
| Directory structure | `git ls-tree --name-only -d HEAD <path>` |
| Test runner, location, mocks | test config/imports; `git ls-files` test names; shared test utilities |
| Persistence/migrations | tracked schema/migration/storage code and real up/down commands |
| Logger/levels/redaction | project-owned wrapper definition and representative call sites |
| Metrics/tracing | existing project entry points; no infrastructure means delete the block |
| Design tokens/themes | token definition file; enumerate every retained light/dark value |
| Components/utilities/breakpoints | tracked component directories and real imports/call sites |
| Extension recipe | a recent same-kind implementation and the files its commit changed |
| Dependency direction | imports plus existing violations/exemption baseline |
| Generated output | `Code generated`, `@generated`, `DO NOT EDIT`, and generator command |
| E2E driver/ports/env/oracle | the harness built this round; backfill actual values after it runs |
| Enforcement claims | real config, guard test, CI/pre-commit job and exemption path |

Use tracked-state commands:

```bash
git grep -n '<symbol or call>' -- <tracked scope>
git ls-files --error-unmatch '<path>'
git ls-tree --name-only -d HEAD '<directory>'
```

Do not use untracked experimental files as documentation evidence. A selected new convention may be sourced from its landed, run implementation before commit.

## Final fact check

For every generated document, sample at least five concrete symbols/paths/commands. One failure reopens the whole document's fact audit. Then run the repository-wide documentation link/anchor checks and the project's final verification command.

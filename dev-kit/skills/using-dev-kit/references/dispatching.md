# What to dispatch to a subagent

The main session is the **orchestrator**: it holds the goal, the constraints, the decisions and the conversation with the user. In `subagent` mode it makes decisions from subagent reports and does not review source code, commits or diffs itself. Work that would flush out its context — and every code-level review — gets dispatched.

## Three properties, all required

| Property | What it means | Without it |
|---|---|---|
| **The input can be written down** | The context it needs fits in a prompt, or points at a file | You have not thought it through — go think first |
| **The output can be verified** | A command plus an exit code, a file you can open, a conclusion you can re-check | You are letting it happen, not judging it |
| **Loud middle, small conclusion** | Hundreds of lines of intermediate output, a conclusion of a few lines | The noise eats the main session's context |

## Three kinds not to dispatch

- **Anything needing back-and-forth with the user** — a subagent cannot ask them.
- **Tightly coupled short loops** — `test-driven-development`'s RED→GREEN is the case to know: the whole round travels together or not at all.
- **Parallel work whose independence is not proved** — different filenames are insufficient. Shared interfaces, generators, lockfiles, fixtures, snapshots, configuration, ports, services, caches, browser profiles or external accounts make tasks coupled. If any write, dependency, resource or verification boundary is unknown, dispatch serially.

## Concurrency is opt-in

Parallelism is an optimization after the work has been understood, not the default shape of every ready set. Before concurrent implementation, the main session records explicit plan facts or a read-only subagent report showing that exact write sets, semantic dependencies, mutable resources and focused verification are independent. “No conflict noticed” is not evidence; uncertainty falls back to serial execution.

Read-only work is safer, not automatically safe: two investigations may still fight over a server, browser profile or output path. Static reviewers may run together because their outputs are read-only and deliberately separate. Tasks that write or drive runtime state use the stricter gate in [`executing-plans`](../../executing-plans/SKILL.md#parallel-is-proved-not-assumed).

## What must be dispatched

**The static wrap-up reviewers and the fresh runtime verifier** — not for context but for isolation. A round running `inline` runs them in that session instead; either way static wrap-up must reach `passed` through its bounded review-and-fix flow before runtime verification starts.

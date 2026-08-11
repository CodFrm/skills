---
name: writing-plans
description: >-
  Use once any spec is approved: write one compact task for a small change or multiple vertical slices for longer work. Use again when work decomposes differently than planned. Writes `.dev-kit/plans/<slug>.yaml`; the spec still owns what to build.
---

# Writing a plan

## Entry gate

Require an approved spec committed in the prepared round workspace. Without either, return to `brainstorming` or `using-git-worktrees`.

The spec owns requirements. The plan owns route, dependencies, dispatch state and recovery. It uses the spec slug and lives at `.dev-kit/plans/<spec-slug>.yaml` (gitignored).

Before writing, read the whole spec, affected modules, existing tests and project precedent. Every `context` fact needs `file:line` or a command result.

## The file

```yaml
spec: docs/specs/2026-07-30-oauth-login.md
status: draft                 # draft → ready → running → done | stopped
mode: null                    # subagent | inline; user/available harness sets this at ready gate
worktree: .dev-kit/worktrees/oauth-login  # or "none: <reason>"

goal: "<one observable finish condition>"
context:
  - "<verified fact with file:line or command>"

tasks:
  - id: 1
    goal: "<one observable vertical slice>"
    deps: []                  # only ordering source
    files: [src/auth/]        # expected writes
    model: null               # cheap | mid | strong | null; never a model id
    interfaces: null          # consumed cross-task name/signature, on the consumer
    status: todo              # todo → doing → done | blocked
    commit: null
    note: null

review:
  status: pending             # pending → running → passed | stopped
  axis: none                  # none | spec | code
  head: null                  # current axis pre-dispatch HEAD
  receipt: null               # ignored .dev-kit/reviews/<slug>/<axis>.md
  fixes: []                   # up to four wrap-up pass SHAs
  note: null

verification:
  status: pending             # pending → running → reported → accepted | blocked
  report: null
  head: null
  note: null
```

Record `files` wide enough to include generated files, lockfiles, manifests, fixtures, snapshots and formatter-owned output.

`review` makes each writable axis recoverable; its receipt records the completed invocation, while only the main session writes axis state. `verification` records the runtime pass; never infer acceptance from a report file. Only the main session writes the plan.

## Cutting the tasks

- Each task is one observable vertical slice and one complete RED → GREEN → REFACTOR round.
- Prefer the largest independently reviewable slice that fits one context window. Combine adjacent work that shares an outcome and test setup; do not make a task for each file, function, test case or mechanical step.
- Never split tests, types or layers into separate tasks.
- Put every known ordering constraint in `deps`; list order has no meaning.
- Put each cross-task interface/signature on the consuming task.

## Choosing a model: a tier, never an id

| Task state | Tier |
|---|---|
| File, command and precedent already identify the method | `cheap` |
| Cross-file coordination or bounded investigation remains | `mid` |
| Design judgement or broad code reading remains | `strong` |
| Inherit the parent session | `null` |

The executor resolves tiers against models available at dispatch time.

## The gate, then freeze

Run the checklist, then send one message containing:

- plan slug, workspace and task count;
- every task's id, goal and deps;
- a request to approve or recut the breakdown;
- execution-mode choices: `subagent` and `inline` when the current harness exposes native dispatch, otherwise only `inline`.

Explain that `subagent` runs each dispatched step in a fresh context, while `inline` runs the same steps in the main context, where no review is independent of the work it reviews. Runtime verification runs in the main session under either mode.

Wait for both decisions. A recut plan repeats the complete gate. Write `status: ready` and `mode` only from the answer, except a harness with no native dispatch forces `inline`.

Once ready, execution may write statuses, commits, notes, review/verification state and new verified context. Goals, deps, files and model tiers remain frozen until the user approves a recut. A changed requirement returns to `brainstorming`; a changed decomposition returns here.

Then hand the ready plan to [`executing-plans`](../executing-plans/SKILL.md).

## Checklist

- [ ] Spec is approved, committed, and shares the plan slug/workspace
- [ ] Context facts are currently verified; no requirement is duplicated into the plan
- [ ] Every task is one observable vertical slice with complete deps and wide files
- [ ] Cross-task interfaces are recorded on consumers; model values are tiers or null
- [ ] The user approved both the current breakdown and available execution mode

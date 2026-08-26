---
name: writing-plans
description: >-
  Use after an approved spec is committed in its prepared workspace, and again when work decomposes differently than approved. Writes and freezes `.dev-kit/plans/<slug>.yaml`; the spec still owns what to build.
---

# Writing a plan

## Entry and ownership

Require an approved spec committed in the prepared round workspace. Otherwise return to `brainstorming` or `using-git-worktrees`.

The spec owns requirements. The plan owns execution route, dependencies, dispatch state and recovery. Only the main session writes `.dev-kit/plans/<spec-slug>.yaml`.

Ask the user to choose `mode` before exploring, recommendation first with the slice count it rests on: `subagent` when the spec reads as several slices whose writes separate cleanly, or when one slice needs more reading than a single context holds; `inline` for a short dependency chain in one area, where dispatch and handoff cost more than concurrency returns. Every context fact requires a resolving `file:line` or command result.

## The file

```yaml
spec: docs/specs/2026-07-30-oauth-login.md
status: draft                 # draft → ready → running → done | stopped
mode: null                    # subagent | inline; chosen before the cut
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
    interfaces: null          # consumed cross-task contract
    status: todo              # todo → doing → done | blocked
    commit: null
    note: null

review:
  status: pending             # pending → running → passed | stopped
  axis: none                  # none | spec | code
  head: null                  # current axis pre-dispatch HEAD
  receipt: null               # .dev-kit/reviews/<slug>/<axis>.md
  fixes: []                   # up to two wrap-up pass SHAs
  note: null

verification:
  status: pending             # pending → running → reported → accepted | blocked
  report: null
  head: null
  note: null
```

`review` makes each writable axis recoverable; its receipt records the completed invocation, while only the main session changes axis state. `verification` records runtime progress; never infer acceptance from a report file.

## Explore

- `inline`: read the complete spec, affected modules, existing tests and project precedent.
- `subagent`: serially dispatch one read-only [planning scout](references/planning-scout.md) at `strong`. It returns verified context, a proposed breakdown and the project's shared-write inventory.

Check that every cited `file:line` resolves, every goal is observable, dependencies are acyclic and `files` cover the returned inventory. Re-dispatch once against a named failure; after a second failure, cut tasks in the main session. A `stuck` spec/code contradiction returns to `brainstorming`.

## Cut tasks

1. Make each task one observable vertical slice and complete RED → GREEN → REFACTOR round. Prefer the largest independently reviewable slice fitting one context; combine work sharing an outcome and test setup. Never split tests, types or layers into separate tasks.
2. Put every ordering constraint in `deps`; list order has no meaning. Put each cross-task interface or signature on its consuming task.
3. Set `files` wide enough to include every direct or shared write, including generated output, lockfiles, manifests, fixtures, registries and formatter-owned files.
4. Under `subagent`, assign each task a tier from what its implementer must read and decide, never a model id: `cheap` for an identified method, `mid` for bounded investigation or coordination, `strong` for design judgement or broad reading, and `null` to inherit. Under `inline`, leave every `model` null.

## Schedule subagent tasks

Under `mode: subagent`, run one scheduling pass before the gate. The main session runs this pass itself: derive every potentially co-ready pair from `deps`, compare every such pair's `files`, and add a dependency for each overlap. Tasks overlap when either names the same path, one path contains the other, or both reach a shared-write path. Do not order disjoint tasks. End the pass by projecting the batches the finished `deps` permit — the ready set at each step.

Only `subagent` implementation tasks may run concurrently, and only when dependencies are satisfied and write paths are disjoint. All other dispatch, including planning and both wrap-up axes, remains serial.

## Approval and freeze

Send one approval request containing the plan slug, workspace, `mode`, task count, each task's id/goal/deps, and under `subagent` each task's tier and the projected batches. When `subagent` projects no concurrent batch, say so and recommend `inline`. Switching to `inline` at the gate needs no recut; switching to `subagent` needs the scheduling pass before freeze. If the user requests a recut, repeat exploration, task cutting and scheduling with the reason recorded.

Write `status: ready` only after the user approves the current breakdown. Once ready, execution may update statuses, commits, notes, review/verification state and verified context. Goals, dependencies, files and model tiers remain frozen until the user approves a recut. A changed requirement returns to `brainstorming`; changed decomposition returns here.

Before handing the ready plan to [`executing-plans`](../executing-plans/SKILL.md), verify the approved spec, slug and workspace agree; context and scout material passed their checks; tasks have complete dependencies, interfaces and write paths; scheduling is safe; and the user approved this exact breakdown.

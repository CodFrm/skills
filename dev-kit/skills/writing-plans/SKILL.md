---
name: writing-plans
description: >-
  Use once any spec is approved: write one compact task for a small change or multiple vertical slices for longer work. Use again when work decomposes differently than planned. Writes `.dev-kit/plans/<slug>.yaml`; the spec still owns what to build.
---

# Writing a plan

## Entry gate

Require an approved spec committed in the prepared round workspace. Without either, return to `brainstorming` or `using-git-worktrees`.

The spec owns requirements. The plan owns route, dependencies, dispatch state and recovery. It uses the spec slug and lives at `.dev-kit/plans/<spec-slug>.yaml` (gitignored).

Read the current harness [mapping](../using-dev-kit/SKILL.md#platform-tools) and set `mode` from the tool list it names: `subagent` when that tool is exposed, `inline` otherwise. The user does not choose it.

Every `context` fact needs `file:line` or a command result.

## The file

```yaml
spec: docs/specs/2026-07-30-oauth-login.md
status: draft                 # draft → ready → running → done | stopped
mode: null                    # subagent | inline; the harness tool list sets this before the cut
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
  fixes: []                   # up to two wrap-up pass SHAs
  note: null

verification:
  status: pending             # pending → running → reported → accepted | blocked
  report: null
  head: null
  note: null
```

Record `files` wide enough to cover every shared-write path: generated artifacts, lockfiles, manifests, fixtures, snapshots, registries, translations, configuration and formatter-owned output. Two tasks overlap when their `files` name one path, one contains the other, or both reach one shared-write path.

`review` makes each writable axis recoverable; its receipt records the completed invocation, while only the main session writes axis state. `verification` records the runtime pass; never infer acceptance from a report file. Only the main session writes the plan.

## Exploring before the cut

Under `mode: inline`, read the whole spec, affected modules, existing tests and project precedent yourself.

Under `mode: subagent`, dispatch one read-only [planning scout](references/planning-scout.md) at `strong` instead. It returns `context` facts, a proposed breakdown and this project's shared-write inventory.

Check that return mechanically before any of it reaches the plan: every cited `file:line` resolves, every proposed goal names an observable result, every `files` list covers the inventory paths that task touches, and `deps` has no cycle. Re-dispatch once against the named failure; a second failure means you cut the tasks yourself. A `stuck` return naming a spec/code contradiction goes back to `brainstorming`, not to a re-dispatch.

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

## Scheduling the batches

Under `mode: subagent`, run one scheduling pass before the gate: derive which tasks can become ready together from `deps`, then compare every such pair's `files` under [the overlap rule](#the-file). Add a dependency for every overlap; do not add ordering between disjoint tasks.

The main session runs this pass itself, whatever the scout proposed: a wrong "disjoint" puts two implementers on one file, and nothing downstream reports it.

## The gate, then freeze

Run the checklist, then send one message containing:

- plan slug, workspace and task count;
- every task's id, goal and deps, plus the resulting concurrent batches under `mode: subagent`;
- a request to approve or recut the breakdown.

A recut repeats everything from [exploration](#exploring-before-the-cut) on, carrying the recut reason. Write `status: ready` only from that answer.

Once ready, execution may write statuses, commits, notes, review/verification state and new verified context. Goals, deps, files and model tiers remain frozen until the user approves a recut. A changed requirement returns to `brainstorming`; a changed decomposition returns here.

Then hand the ready plan to [`executing-plans`](../executing-plans/SKILL.md).

## Checklist

- [ ] Spec is approved, committed, and shares the plan slug/workspace
- [ ] Context facts are currently verified; no requirement is duplicated into the plan
- [ ] Every task is one observable vertical slice with complete deps and wide files
- [ ] Cross-task interfaces are recorded on consumers; model values are tiers or null
- [ ] `mode` came from the harness tool list; any scout return passed the mechanical check before reaching the plan
- [ ] In `subagent` mode, the scheduling pass made every potentially co-ready pair write-disjoint or dependency-ordered
- [ ] The user approved the current breakdown

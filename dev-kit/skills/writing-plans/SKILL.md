---
name: writing-plans
description: >-
  Use once a spec is approved and the change breaks into more than about three steps or spans sessions, and again when work under way decomposes differently than planned. Writes `.dev-kit/plans/<slug>.yaml`. Not for: settling what to build — that is the spec, and it comes first.
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
    files: [src/auth/]        # expected writes; evidence input, never parallel permission
    model: null               # cheap | mid | strong | null; never a model id
    interfaces: null          # consumed cross-task name/signature, on the consumer
    status: todo              # todo → doing → reviewing → done | blocked
    commit: null
    note: null

parallel_evidence: []         # executing-plans writes immediately before each parallel dispatch
  # - tasks: [3, 4]           # ids or stage labels
  #   head: <exact HEAD SHA>
  #   source: "<plan facts or read-only scout report>"
  #   writes: "<exact disjoint write sets>"
  #   dependencies: "<no semantic/interface dependency>"
  #   resources: "<no shared mutable runtime/external resource>"
  #   verification: "<each focused check is independently meaningful>"

review:
  status: pending             # pending → passed | stopped
  fixes: []                   # up to two wrap-up fixer SHAs

verification:
  status: pending             # pending → running → reported → accepted | blocked
  report: null
  head: null
  note: null
```

Record `files` wide enough to include generated files, lockfiles, manifests, fixtures, snapshots and formatter-owned output. [`executing-plans`](../executing-plans/SKILL.md#parallel-is-proved-not-assumed) alone authorizes concurrency.

`reviewing` means an implementer commit exists but independent task/batch review is incomplete. `verification` records the fresh runtime pass; never infer acceptance from a report file. Only the main session writes the plan.

## Cutting the tasks

- Each task is one observable vertical slice and one complete RED → GREEN → REFACTOR round.
- Never split tests, types or layers into separate tasks.
- Size each task to one context window.
- Put every known ordering constraint in `deps`; list order has no meaning.
- Put each cross-task interface/signature on the consuming task.
- Do not manufacture tasks or concurrency. Unknown boundaries execute serially.

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
- any parallel candidates labelled as candidates only;
- a request to approve or recut the breakdown;
- execution-mode choices: `subagent` and `inline` when the current harness exposes native dispatch, otherwise only `inline`.

Explain that `subagent` gives fresh implementer/reviewer contexts; concurrency still requires the execution-time four-boundary gate. Explain that `inline` has no independent task/batch review, while static wrap-up and runtime verification still run in the main context.

Wait for both decisions. A recut plan repeats the complete gate. Write `status: ready` and `mode` only from the answer, except a harness with no native dispatch forces `inline`.

Once ready, execution may write statuses, commits, notes, `parallel_evidence`, review/verification state and new verified context. Goals, deps, files and model tiers remain frozen until the user approves a recut. A changed requirement returns to `brainstorming`; a changed decomposition returns here.

Then hand the ready plan to [`executing-plans`](../executing-plans/SKILL.md).

## Checklist

- [ ] Spec is approved, committed, and shares the plan slug/workspace
- [ ] Context facts are currently verified; no requirement is duplicated into the plan
- [ ] Every task is one observable vertical slice with complete deps and wide files
- [ ] Cross-task interfaces are recorded on consumers; model values are tiers or null
- [ ] The user approved both the current breakdown and available execution mode

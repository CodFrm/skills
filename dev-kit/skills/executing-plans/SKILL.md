---
name: executing-plans
description: >-
  Use when a `.dev-kit/plans/*.yaml` plan is ready to run, and at the start of any session that finds one whose status is not `done` — including one left half-finished mid-task. Not for: a plan still `draft`.
---

# Executing a plan

## Entry and ownership

Require a `ready` plan, or resume any plan not `done`. Read the entire plan and its spec before acting.

The main session is the orchestrator:

1. Only it writes the plan.
2. It records and routes each return immediately; a task or batch finishing does not pause the loop.
3. In `subagent` mode it never reviews source, commit content or diffs. It decides only from structured implementer/reviewer/verifier results and mechanical SHA/state checks. An insufficient report triggers a fresh reviewer or verifier; the main session never fills the review gap.
4. Work is not complete in the context that produced it: task/batch review → two-axis static wrap-up → fresh runtime verification.

When `devkit` is available, its `plan` subcommands read and write the plan; otherwise edit the YAML directly.

## Resume state

- `doing`: recover its SHA mechanically from history. If ambiguous, dispatch a read-only scout that identifies the commit without judging it. Recovered → `reviewing`; otherwise → `todo`.
- `reviewing`: if no recorded structured review/fix result exists, dispatch [batch review](#the-batch-review-and-its-fix-what-makes-a-task-done) over the recorded SHAs. Never re-dispatch an implementer whose commit exists.
- `verification.pending`: enter runtime verification after static review.
- `verification.running`: check the dispatch; if gone, give a fresh verifier the partial scratch evidence and remaining observations.
- `verification.reported`: inspect the report/evidence, never the branch diff.
- `verification.accepted`: hand back.
- `verification.blocked`: stop and report `verification.note`.

## Starting the run

`mode` normally arrives from [`writing-plans`](../writing-plans/SKILL.md#the-gate-then-freeze). If a ready legacy plan has `mode: null`, ask only the mode half of that gate before starting.

Verify the recorded workspace is the current checkout, the spec is tracked on its branch, `.dev-kit` resolves, and setup recorded a baseline. Route mismatches to [`using-git-worktrees`](../using-git-worktrees/SKILL.md#set-up-and-check-the-baseline-before-the-first-change). Then set plan `status: running`.

## The loop

```text
collect ready tasks
  → select one by default, or a gate-approved parallel batch
  → write doing state
  → implement (TDD; debug first for faults)
  → record SHA/result
  → independent batch review-and-fix in subagent mode
  → full suite
  → repeat
```

Ready means `status: todo` and all `deps` are `done`. `inline` always runs one task at a time and skips batch review.

### Parallel is proved, not assumed

Serial dispatch is the default for implementation, investigation, review/fix, static review and runtime-driving work. Read-only work is not exempt.

Immediately before every parallel dispatch, require plan facts or a read-only scout report bound to the exact current HEAD and proving all four boundaries:

| Boundary | Required fact |
|---|---|
| Writes | Exact write/output sets are disjoint, including generated files, lockfiles, manifests, fixtures, snapshots and formatter output |
| Dependencies | No sibling creates or changes an interface, schema, configuration or behaviour another consumes |
| Resources | No shared mutable port, service, database, cache, package-manager state, browser profile, account or external resource |
| Verification | Each focused check is meaningful without sibling changes; combining results needs no new design decision |

Append a `parallel_evidence` entry naming the work, exact HEAD, evidence source and one concrete statement per boundary, then write the plan. Any missing, ambiguous, stale or expensive-to-prove boundary means serial. Implementer prompts also state exclusive write ownership and forbidden shared resources.

If a collision appears after launch, start no more siblings, preserve completed commits, reconcile mechanically and continue serially.

### Dispatch implementation

Before dispatch, write selected tasks `doing`. Use [the implementer prompt](references/task-prompts.md#implementer) with the exact goal, served spec requirement, files, mode/ownership, model tier and mandatory `test-driven-development`; for a fault, require `systematic-debugging` first. The implementer never writes the plan and commits only its task by path.

A structured return is routing input:

| Status | Transition |
|---|---|
| `complete` | `git cat-file -e <sha>^{commit}` must resolve; write SHA and `reviewing` |
| `complete with concerns` | Same; pass concerns verbatim to the reviewer |
| `missing context` | Add verified missing context and re-dispatch; contradiction goes to the user |
| `stuck` | Change something before retry: add context, raise tier, recut plan, or mark blocked |

If the implementer declares part of its goal incomplete, send it back once for that named shortfall. A second declared shortfall marks the task `blocked`. Do not inspect code or infer additional shortfalls in the main session.

### `inline` mode keeps the evidence gate

Because inline has no independent task/batch review, a task leaves `doing` only after the main session records a command, exit code and observation for each part of its goal. Apply the same one-send-back limit. Static wrap-up and runtime verification still run.

## The batch review and its fix: what makes a task `done`

In `subagent` mode, dispatch [one batch reviewer/fixer](references/task-prompts.md#batch-review-and-fix) after every selected task has left `doing`. It reads only the listed implementer commits with `git show`, never the working tree, and judges:

- each task goal and served spec requirement;
- project conventions;
- sibling consistency/interfaces;
- correctness, failure paths, security and test value.

The reviewer records findings first, then fixes ordinary findings through TDD in one commit. It returns rather than fixes: a wholly unimplemented task goal, a fix requiring a design decision, or a finding that invalidates the plan. Those park the affected task `blocked` and, where requirements/decomposition changed, go to the user.

The main session checks only required fields, explicit unresolved findings and that each reported SHA resolves. Incomplete/ambiguous return → another reviewer. Unresolved blocking findings → affected tasks `blocked`; non-blocking findings → `note`. Otherwise mark tasks `done`, then run the full suite. Diagnose red before selecting another task.

## When to stop, and when not to

Continue through task, batch and green-suite boundaries. Stop for:

- a user decision that changes the agreed requirement or task shape;
- a destructive action or an external side effect not already authorized;
- a verification requirement left unobserved by unconfigured real environment;
- `verification.blocked` or wrap-up `review.status: stopped`.

Limits:

| Scope | Limit | Exhausted state |
|---|---|---|
| Implementer-declared shortfall | one send-back | task `blocked` |
| Batch review findings | one review-and-fix dispatch | blocking task `blocked`; others noted |
| Static wrap-up | two review passes and at most two fixer dispatches | blocking → plan `stopped`; others noted |

## Wrap-up: two static reviews

Enter when every task is `done` or `blocked`. First require `e2e/scratch/<spec-slug>/report.md` to be ignored; if not, add the ignore rule through the normal implementation/review path before static wrap-up.

Run two independent read-only reviews at `strong`, using [separate prompts](references/wrap-up-prompts.md):

| Axis | Reads | Decides |
|---|---|---|
| Spec verification | approved spec + whole branch diff | missing/partial work, unrequested behaviour, wrong implementation of agreed behaviour |
| Code review | whole branch diff, not the spec | correctness, edge cases, error handling, security, dead code, test value and cross-task drift |

Never merge the axes or bias either prompt with earlier review conclusions. Run them concurrently only after the [parallel gate](#parallel-is-proved-not-assumed) records isolated outputs/resources for the exact HEAD; otherwise serially. In `inline` mode, perform both yourself against the same prompts.

Route only their structured findings. Missing fields or ambiguous scope require a replacement reviewer; the main session does not inspect the branch to complete the review.

## The two fix rounds

1. Send initial findings to a fresh fixer; each finding starts with a failing test. Record its SHA and run the full suite.
2. Repeat both static reviews over the full branch.
3. If blocking findings remain, send only those to one final fresh fixer, record its SHA and run the full suite. Do not run a third static review.

A red suite or unresolved blocking finding after the allowance sets `review.status: stopped`. Record lesser findings in task notes. Otherwise set `review.status: passed`, then write `verification.status: running`, report path and exact current HEAD before dispatching runtime verification.

## Runtime verification: a fresh third subagent

After static review passes, dispatch [verification-prompt.md](references/verification-prompt.md) at `strong` to a fresh verifier that implemented or reviewed none of the branch. In `inline` mode, run the same prompt yourself.

The verifier may build/start the real target, drive UI/API/CLI/e2e and write only ignored scratch evidence. It must not fix code, change tracked files, weaken checks, or perform unapproved destructive/external actions. Every spec requirement receives exactly `holds`, `does not hold` or `not observed`, with runtime evidence. The report must include exact reproduction steps for the user.

An incomplete report without an external blocker goes to a fresh verifier for completion. A real blocker, absent report, or still-incomplete replacement sets `verification.status: blocked` with the exact reason.

Otherwise set `verification.status: reported` and inspect the report/evidence only: every requirement present; every `holds` backed by command, exit code and deciding observation; linked artifacts readable; initial/final HEAD, clean tree and plan checksum consistent. Unsupported claims go to another verifier, never to a main-session source/diff review. Observed failure is `does not hold`; unreached evidence is `not observed`.

A requirement `not observed` because `.env` configures no real dependency does not reach `accepted`, and the main session does not stand that dependency up either. Report the blocked requirements, the service and the absent variable names, then route on the answer:

| The user | What you do |
|---|---|
| fills `.env` | write `verification.status: running` and dispatch a fresh verifier scoped to those requirements alone, merged into the same `report.md` |
| authorizes a way to reach an environment | the same, with that sentence verbatim in the new dispatch's pre-authorized list; a mocked path still returns `not observed` |
| declines | those requirements stay `not observed` and reach [delivery](#handing-it-back) unchanged |

Re-verification is not a fix round and does not spend that allowance.

State every non-hold and unobserved requirement. Only the main session sets `verification.status: accepted`, then plan `status: done`. `done` means the bounded verification finished with findings intact, not that every requirement holds.

## Handing it back

Before the delivery menu, hand [`using-git-worktrees`](../using-git-worktrees/SKILL.md#delivery-and-cleanup):

1. every non-hold and blocked task;
2. every standing finding and its reason;
3. every unobserved requirement — or an explicit statement that none remain.

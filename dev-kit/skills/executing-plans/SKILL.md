---
name: executing-plans
description: >-
  Use when a `.dev-kit/plans/*.yaml` plan is ready to run, and at the start of any session that finds one whose status is not `done` — including one left half-finished mid-task. Not for: a plan still `draft`.
---

# Executing a plan

## Entry and ownership

Require a `ready` plan, or resume any plan not `done`. Read the entire plan and its spec before acting.

The main session is the orchestrator:

1. Only it writes the plan; when `devkit` is available, its `plan` subcommands read and write it.
2. It records and routes each return immediately; a finished task does not pause the loop.
3. In `subagent` mode it dispatches a whole safe implementation batch before waiting; all other dispatch, including retries and wrap-up axes, is serial.
4. In `subagent` mode it never reviews source, commits or diffs. It decides from structured returns, ignored wrap-up receipts, runtime observations and mechanical state checks. A lost wrap-up invocation resumes the same recorded axis; it is not a replacement or another review pass.
5. Work is not complete after task implementation: two-axis review-and-fix wrap-up → runtime verification.

## Resume state

- `doing`: recover its SHA mechanically from history; if that is ambiguous, dispatch one read-only scout at `cheap` that identifies the commit without judging it. Recovered → `done` — its structured return is gone, so wrap-up is what judges it; no SHA or an inconclusive scout → `todo`. Never re-dispatch an implementer whose commit exists.
- `review.running`: validate its receipt; route a complete/blocked receipt, or resume the recorded axis against `review.head` without starting another pass.
- `review.passed` with `verification.pending`: put [the verification question](#runtime-verification-the-main-session-drives-it) to the user.
- `verification.running`: resume from the partial scratch evidence, covering every requirement still without a verdict.
- `verification.reported`: inspect the report/evidence, never the branch diff.
- `verification.accepted`: hand back.
- `verification.blocked`: stop and report `verification.note`.

## Starting the run

`mode` arrives from [`writing-plans`](../writing-plans/SKILL.md#entry-gate). A ready legacy plan with `mode: null` takes it from the current harness tool list; never ask.

Verify the recorded workspace is the current checkout, the spec is tracked on its branch, `.dev-kit` resolves, and setup recorded a baseline. Route mismatches to [`using-git-worktrees`](../using-git-worktrees/SKILL.md#set-up-and-check-the-baseline-before-the-first-change). Then set plan `status: running`.

## The loop

```text
collect ready tasks
  → select a safe batch
  → write every selected task doing
  → implement concurrently in subagent mode (TDD; debug first for faults)
  → record a command, exit code and deciding observation per goal part
  → commit and mark each task done
  → full suite
  → repeat
```

Ready means `status: todo` and all `deps` are `done`.

`inline` selects one ready task. `subagent` selects a maximal ready batch whose declared `files` are pairwise disjoint under [the overlap rule](../writing-plans/SKILL.md#the-file). Launch every task in that batch before waiting for any return. If no pair is safe, select one. The scheduling pass in `writing-plans` is the design-time check; repeat it against the frozen plan before every batch.

### Dispatch implementation

Before dispatch, write every selected task `doing`. Use [the implementer prompt](references/task-prompts.md#implementer) with the exact goal, served spec requirement, files, model tier, commit policy and mandatory `test-driven-development`; for a fault, require `systematic-debugging` first. The implementer never writes the plan. A single-task dispatch commits by explicit path; concurrent implementers leave their owned changes uncommitted because a shared Git index and branch HEAD cannot safely accept sibling commits. In `inline` mode the main session is the implementer, against the same prompt and the same structured return.

A structured return is routing input:

| Status | Transition |
|---|---|
| `complete` | For a single task, `git cat-file -e <sha>^{commit}` must resolve; for a concurrent batch, mechanically verify its changed paths stay within `files`, then the main session commits those paths and records that SHA |
| `complete with concerns` | Same, and append only blocking concerns verbatim to the task `note` |
| `missing context` | Add verified missing context and re-dispatch once; a second return marks the task `blocked`, while a contradiction requiring a decision goes to the user |
| `stuck` | Change something once before retry: add context, raise tier or recut the plan; a second return marks the task `blocked` |

### What makes a task `done`

A task leaves `doing` only after the main session records, out of the structured return, one command, its exit code and the deciding observation for each part of the task goal; only a [resumed](#resume-state) task leaves without it. In neither mode does it review source, commits or diffs to complete that record. For a concurrent return, it may only run mechanical path checks, stage the task's explicit `files`, commit them alone, and record the SHA. Route and commit every returned task before selecting another batch. Then write `done` and run the full suite; diagnose red before selecting the next task.

A return that declares a goal part incomplete, or leaves one without that record, goes back once for the named part alone through [the send-back prompt](references/task-prompts.md#send-back) — both causes draw on that single send-back, and a second short return marks the task `blocked`.

After the task loop, any `blocked` task sets plan `status: stopped`; report its exact note and do not enter wrap-up. Only an all-`done` task set may continue.

## When to stop, and when not to

Continue through task and green-suite boundaries. Stop for:

- a user decision that changes the agreed requirement or task shape;
- a destructive action or an external side effect not already authorized;
- a verification requirement left unobserved by unconfigured real environment;
- `verification.blocked` or wrap-up `review.status: stopped`.

Limits:

| Scope | Limit | Exhausted state |
|---|---|---|
| Resume commit scout | one dispatch | task `todo` |
| `missing context` or `stuck` | one re-dispatch | task `blocked` |
| Incomplete implementer return | one send-back | task `blocked` |
| Wrap-up axis | one writable pass, and it is final | review `stopped` |

## Wrap-up: two review-and-fix axes

Enter only when every task is `done`. Require both `.dev-kit/reviews/<spec-slug>/` and the evidence directory [runtime verification](references/runtime-verification.md#before-running) resolves to be ignored; add a missing rule through the normal implementation path before wrap-up.

Run the two independent axes serially at `strong`, using [separate prompts](references/wrap-up-prompts.md) and the [shared writable-axis contract](references/prompts.md#writable-wrap-up-axis). Each axis gets exactly one writable pass, which reviews the whole current branch, fixes its findings, reviews its own fixes, runs the full suite and makes at most one commit:

| Axis | Reads | Owns |
|---|---|---|
| Spec verification | approved spec + whole branch diff | missing/partial work, unrequested behaviour and wrong implementation of agreed behaviour |
| Code review | whole branch diff, not the spec | correctness, edge cases, error handling, security, dead code, test value and cross-task drift |

Before each axis, require a clean tree and record `review.status: running`, its `axis`, exact pre-dispatch `head` and `.dev-kit/reviews/<slug>/<axis>.md` `receipt`. Give the axis the absolute workspace, branch range, pre-dispatch HEAD, receipt, full-suite command, commit convention and write boundary. Never merge the axes or put one axis's conclusions into the other prompt. In `inline` mode, perform the same state transitions and receipt writes yourself.

On return or resume, require the receipt to match the recorded axis/head, report each finding and action, resolve final HEAD, leave a clean tree and carry an exit code and deciding observation for every required command. Rerun the full suite. A blocked/invalid receipt or red suite sets review and plan `stopped`; do not replace the axis, dispatch a fixer or finish it in the main session.

A valid pass completes its axis, whether or not it fixed anything; when its final HEAD differs from the recorded head, append that HEAD to `review.fixes`. Never dispatch the same axis again to re-check its own fixes — the pass owns that check. A completed spec axis advances to a freshly recorded code axis; a completed code axis sets review `passed`, clears `axis/head/receipt`, then puts [the verification question](#runtime-verification-the-main-session-drives-it) to the user.

## Runtime verification: the main session drives it

Once review is `passed`, run nothing until the user answers one message that asks both halves together:

- whether to run runtime verification on this branch now, or hand straight to delivery;
- and, for every spec requirement whose real dependency `.env` does not configure or whose effect is outside the authorization list, the service and the absent variable names — names only — or the exact effect and what it touches.

Read the spec, `docs/verification.md` and `.env` to name that second half before asking; the answer routes both:

| Answer | What you do |
|---|---|
| straight to delivery | set verification `blocked` and plan `stopped`, that sentence verbatim as `verification.note`, then [hand back](#handing-it-back) with every requirement unobserved |
| run it | set verification `running` and drive it yourself, under either mode, following [runtime-verification.md](references/runtime-verification.md) |
| with `.env` filled, or a way to reach an environment or a substitute for it authorized | cover those requirements in the same run, recording the authorizing sentence verbatim in the report's authorization list; a substituted dependency reaches `holds` only with its verdict row naming what it does not cover |
| with the missing input declined | run the rest and finish those requirements `not observed`, naming the service and absent variable names in the report |

Never dispatch the run: a subagent cannot ask the user, and a gap the question did not predict still needs an answer mid-run.

You may build/start the real target, drive UI/API/CLI/e2e and write only ignored scratch evidence. You must not fix code, change tracked files, weaken checks, or perform an unapproved destructive/external action. Every spec requirement receives exactly `holds`, `does not hold` or `not observed`, with runtime evidence. The report must include exact reproduction steps for the user.

A target that cannot be built or started sets `verification.status: blocked` with the exact reason.

A dependency or authorization gap the question did not predict blocks those requirements alone, and you never stand that dependency up yourself. Carry every other requirement to a verdict, then ask once more in the same shape and route by the same table, resuming answered requirements alone and merging their evidence into the same `report.md`.

Once the report is written, set `verification.status: reported` and check it against the evidence: every requirement present; every `holds` backed by how the target was driven, its exit code where the form produces one, and a deciding observation; linked artifacts readable; initial/final HEAD, clean tree and plan checksum consistent. An unsupported claim is re-observed at the runtime or downgraded — never argued from source or diff.

If every requirement holds, set verification `accepted` and plan `done`. Otherwise keep `reported`, state every non-hold/unobserved requirement and ask the user to choose: accept the findings for delivery, provide/authorize the missing real input, or request a separately approved correction round. Only explicit acceptance sets verification `accepted` and plan `done`; runtime verification never fixes tracked files or starts that round itself.

## Handing it back

Before the delivery menu, hand [`using-git-worktrees`](../using-git-worktrees/SKILL.md#delivery-and-cleanup):

1. every non-hold and blocked task;
2. every standing finding and its reason;
3. every unobserved requirement — or an explicit statement that none remain.

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
3. Dispatch is serial — one subagent, its return recorded, then the next. The sole exception is the two static wrap-up axes, which are read-only and go out together.
4. In `subagent` mode it never reviews source, commit content or diffs. It decides from structured implementer/reviewer results, its own runtime observations and mechanical SHA/state checks. An insufficient return is closed by another dispatch, never by the main session's own inspection.
5. Work is not complete in the context that produced it: two-axis static wrap-up → runtime verification.

## Resume state

- `doing`: recover its SHA mechanically from history; if that is ambiguous, dispatch a read-only scout that identifies the commit without judging it. Recovered → `done` — its structured return is gone, so wrap-up is what judges it; no SHA → `todo`. Never re-dispatch an implementer whose commit exists.
- `verification.pending`: enter runtime verification after static review.
- `verification.running`: resume from the partial scratch evidence, covering every requirement still without a verdict.
- `verification.reported`: inspect the report/evidence, never the branch diff.
- `verification.accepted`: hand back.
- `verification.blocked`: stop and report `verification.note`.

## Starting the run

`mode` normally arrives from [`writing-plans`](../writing-plans/SKILL.md#the-gate-then-freeze). If a ready legacy plan has `mode: null`, ask only the mode half of that gate before starting.

Verify the recorded workspace is the current checkout, the spec is tracked on its branch, `.dev-kit` resolves, and setup recorded a baseline. Route mismatches to [`using-git-worktrees`](../using-git-worktrees/SKILL.md#set-up-and-check-the-baseline-before-the-first-change). Then set plan `status: running`.

## The loop

```text
collect ready tasks
  → select one
  → write doing state
  → implement (TDD; debug first for faults)
  → record a command, exit code and deciding observation per goal part
  → done
  → full suite
  → repeat
```

Ready means `status: todo` and all `deps` are `done`.

### Dispatch implementation

Before dispatch, write the selected task `doing`. Use [the implementer prompt](references/task-prompts.md#implementer) with the exact goal, served spec requirement, files, model tier and mandatory `test-driven-development`; for a fault, require `systematic-debugging` first. The implementer never writes the plan and commits only its task by path.

A structured return is routing input:

| Status | Transition |
|---|---|
| `complete` | `git cat-file -e <sha>^{commit}` must resolve; record the SHA |
| `complete with concerns` | Same, and copy the concerns verbatim into the task `note` |
| `missing context` | Add verified missing context and re-dispatch; contradiction goes to the user |
| `stuck` | Change something before retry: add context, raise tier, recut plan, or mark blocked |

### What makes a task `done`

A task leaves `doing` only after the main session records, out of the structured return, one command, its exit code and the deciding observation for each part of the task goal. In neither mode does it read source, commits or diffs to complete that record. Then write `done` and run the full suite; diagnose red before selecting the next task.

A return that declares a goal part incomplete, or that carries no command and exit code for one, goes back to that implementer once for the named part alone — both causes draw on that single send-back, and a second short return marks the task `blocked`.

## When to stop, and when not to

Continue through task and green-suite boundaries. Stop for:

- a user decision that changes the agreed requirement or task shape;
- a destructive action or an external side effect not already authorized;
- a verification requirement left unobserved by unconfigured real environment;
- `verification.blocked` or wrap-up `review.status: stopped`.

Limits:

| Scope | Limit | Exhausted state |
|---|---|---|
| Incomplete implementer return | one send-back | task `blocked` |
| Static wrap-up | two review passes and at most two fixer dispatches | blocking → plan `stopped`; others noted |

## Wrap-up: two static reviews

Enter when every task is `done` or `blocked`. First require `e2e/scratch/<spec-slug>/report.md` to be ignored; if not, add the ignore rule through the normal implementation path before static wrap-up.

Send two independent read-only reviews together at `strong`, using [separate prompts](references/wrap-up-prompts.md):

| Axis | Reads | Decides |
|---|---|---|
| Spec verification | approved spec + whole branch diff | missing/partial work, unrequested behaviour, wrong implementation of agreed behaviour |
| Code review | whole branch diff, not the spec | correctness, edge cases, error handling, security, dead code, test value and cross-task drift |

Never merge the axes or bias either prompt with earlier review conclusions. In `inline` mode, perform both yourself against the same prompts.

Route only their structured findings. Missing fields or ambiguous scope require a replacement reviewer; the main session does not inspect the branch to complete the review.

## The two fix rounds

1. Send initial findings to a fresh fixer; each finding starts with a failing test. Record its SHA and run the full suite.
2. Repeat both static reviews over the full branch.
3. If blocking findings remain, send only those to one final fresh fixer, record its SHA and run the full suite. Do not run a third static review.

A red suite or unresolved blocking finding after the allowance sets `review.status: stopped`. Record lesser findings in task notes. Otherwise set `review.status: passed`, then write `verification.status: running`, report path and exact current HEAD before starting runtime verification.

## Runtime verification: the main session drives it

After static review passes, verify the branch in its real runtime yourself, under either mode, following [runtime-verification.md](references/runtime-verification.md). Never dispatch it: a subagent cannot ask the user, and this step is where the user's answer is needed mid-run.

You may build/start the real target, drive UI/API/CLI/e2e and write only ignored scratch evidence. You must not fix code, change tracked files, weaken checks, or perform an unapproved destructive/external action. Every spec requirement receives exactly `holds`, `does not hold` or `not observed`, with runtime evidence. The report must include exact reproduction steps for the user.

A target that cannot be built or started sets `verification.status: blocked` with the exact reason.

A requirement `not observed` because `.env` configures no real dependency does not reach `accepted`, and you do not stand that dependency up either. Report the blocked requirements, the service and the absent variable names, then route on the answer:

| The user | What you do |
|---|---|
| fills `.env` | resume those requirements alone and merge their evidence into the same `report.md` |
| authorizes a way to reach an environment | the same, recording that sentence verbatim in the report's authorization list; a mocked path still returns `not observed` |
| declines | those requirements stay `not observed` and reach [delivery](#handing-it-back) unchanged |

Once the report is written, set `verification.status: reported` and check it against the evidence: every requirement present; every `holds` backed by command, exit code and deciding observation; linked artifacts readable; initial/final HEAD, clean tree and plan checksum consistent. An unsupported claim is re-observed at the runtime or downgraded — never argued from source or diff.

State every non-hold and unobserved requirement, then set `verification.status: accepted` and plan `status: done`. `done` means the bounded verification finished with findings intact, not that every requirement holds.

## Handing it back

Before the delivery menu, hand [`using-git-worktrees`](../using-git-worktrees/SKILL.md#delivery-and-cleanup):

1. every non-hold and blocked task;
2. every standing finding and its reason;
3. every unobserved requirement — or an explicit statement that none remain.

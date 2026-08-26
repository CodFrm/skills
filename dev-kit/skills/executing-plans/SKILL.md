---
name: executing-plans
description: >-
  Use when a `.dev-kit/plans/*.yaml` plan is ready to run, and at the start of any session that finds one whose status is not `done` — including one left half-finished mid-task. Not for: a plan still `draft`.
---

# Executing a plan

## Entry and ownership

Require a `ready` plan, or resume one not `done`. Read its spec and plan; read and write only the copy in the round workspace's own `.dev-kit/plans/`, including when the session starts outside that workspace — a copy in the original checkout is a delivered record. Verify the recorded workspace, tracked spec, `.dev-kit` and baseline; route a mismatch to [`using-git-worktrees`](../using-git-worktrees/SKILL.md#set-up-and-check-the-baseline-before-the-first-change).

Only the main session writes plan state and routes every return. `mode` comes from `writing-plans`. A ready plan with `mode: null` never had the concurrency scheduling pass, so it runs `inline`; never ask mid-run. Set a new run to `running`.

In `subagent` mode the main session dispatches every safe implementation task in a batch before waiting; all other dispatch, including retries and wrap-up axes, is serial. It never reviews source, commits or diffs, deciding from structured returns, wrap-up receipts, its runtime observations and mechanical checks. Reading launch instructions, interfaces and selectors to drive runtime verification is allowed.

## Resume state

| Recorded state | Resume action |
|---|---|
| task `doing` | Recover its SHA mechanically. If ambiguous, dispatch one read-only scout at `cheap` that identifies the commit without judging it. Commit found → `done`; no commit or inconclusive scout → `todo`. Never re-run an implementer whose commit exists. |
| `review.running` | Validate the receipt and route it, or resume that recorded axis against `review.head`. A lost invocation is not a new pass. |
| `review.passed`, verification `pending` | Ask [the verification question](#runtime-verification-the-main-session-drives-it). |
| verification `running` | Resume the same evidence set for requirements without verdicts. |
| verification `reported` | Check the report and evidence, never the branch diff. |
| verification `accepted` | Hand back for delivery. |
| verification `blocked` | Stop and report `verification.note`. |

## The loop

```text
collect ready tasks
  → select a safe batch and mark every task doing
  → implement with TDD; debug faults first
  → record command, exit code and deciding observation for every goal part
  → commit and mark each task done
  → run the full suite
  → repeat
```

Ready means `todo` with every `dep` `done`. `inline` selects one task. `subagent` selects a maximal ready batch whose declared `files` are pairwise disjoint under [`writing-plans`](../writing-plans/SKILL.md#the-file). Launch every task in that batch before waiting for any return. If no pair is safe, select one. Repeat this mechanical scheduling check before every batch.

[task-prompts.md](references/task-prompts.md) owns dispatch inputs and prompts. In `inline` mode the main session is the implementer, against the same prompt and the same structured return. An implementer never writes the plan. A single task commits explicit paths; concurrent implementers leave their owned changes uncommitted because they share an index and HEAD.

Route each structured return before selecting more work:

| Return | Route |
|---|---|
| `complete` | Single task: require its SHA to resolve. Concurrent task: mechanically prove changed paths stay within `files`, then commit only those paths. Record the SHA. |
| `complete with concerns` | As above; append only blocking concerns verbatim to `note`. |
| `missing context` | Add verified context and retry once; a second return blocks the task. A contradiction needing a decision goes to the user. |
| `stuck` | Change context, tier or decomposition once before retry; a second return blocks the task. |

A task leaves `doing` only after the main session records one command, exit code and deciding observation for each part of the task goal; only a [resumed](#resume-state) task leaves without it. A return that declares a goal part incomplete, or leaves one without that record, goes back for the named gap through the [send-back prompt](references/task-prompts.md#send-back); both causes draw on that single send-back, and another incomplete return blocks the task. In neither mode may the main session inspect code or diffs to complete this evidence.

After each completion, write `done` and run the full suite; diagnose red before continuing. After the loop, any `blocked` task sets plan `status: stopped`; report its note and do not enter wrap-up.

## When to stop, and when not to

Stop for a requirement or task-shape decision, unauthorized destructive/external effect, unconfigured real verification dependency, blocked task, `verification.blocked`, or review `stopped`.

Nothing else ends the turn: between tasks, batches and wrap-up axes neither mode reports progress and waits for a go-ahead, and the only other user turn is [the verification question and its acceptance](#runtime-verification-the-main-session-drives-it).

These limits are final:

| Scope | Limit | Exhausted state |
|---|---|---|
| Resume commit scout | one dispatch | task `todo` |
| `missing context` or `stuck` | one re-dispatch | task `blocked` |
| Incomplete implementer return | one send-back | task `blocked` |
| Wrap-up axis | one writable pass, and it is final | review `stopped` |

A changed requirement returns to `brainstorming`; an approved decomposition change returns to `writing-plans`.

## Wrap-up: two independent writable axes

Enter only when every task is `done`. Require `.dev-kit/reviews/<slug>/` and the [runtime evidence directory](references/runtime-verification.md#before-running) to resolve as ignored; add a missing rule through the normal implementation path.

Run the axes serially at `strong`. Each axis gets exactly one writable pass that reviews the whole branch, fixes its own findings, reviews its own fixes, runs the full suite and makes at most one commit:

| Axis | Reads and owns |
|---|---|
| Spec verification | Approved spec and whole branch diff; owns missing, partial, unrequested or incorrectly implemented agreed behaviour. |
| Code review | Whole branch diff, not the spec; owns correctness, edges, error handling, security, dead code, test value and cross-task drift. |

Before each axis require a clean tree and record `review.running`, axis, pre-dispatch HEAD and ignored receipt path. [wrap-up-prompts.md](references/wrap-up-prompts.md) and [prompts.md](references/prompts.md#writable-wrap-up-axis) own its prompt and receipt. Never merge axes or pass conclusions between them.

On return or resume, require a matching receipt, final HEAD, clean tree, every finding/action and required-suite command evidence; rerun that suite. A blocked or invalid receipt, dirty tree or red suite stops review and plan. Do not replace the axis, dispatch a fixer or finish it in the main session.

A valid pass completes the axis whether or not it changed code; append a changed final HEAD to `review.fixes`. Never dispatch the same axis again to re-check its own fixes. Spec completion advances to a freshly recorded code axis. Code completion sets review `passed`, clears its active fields, then puts [the verification question](#runtime-verification-the-main-session-drives-it) to the user.

## Runtime verification: the main session drives it

Once review is `passed`, run nothing until the user answers one message that asks both halves together:

1. whether to run runtime verification on this branch now, or hand straight to delivery;
2. for every spec requirement whose real dependency `.env` does not configure or whose effect is outside the authorization list, the service and missing variable names only, or the exact effect and target.

Read the spec, `docs/verification.md` and `.env` before naming gaps. Route the answer:

| Answer | Action |
|---|---|
| straight to delivery | set verification `blocked` and plan `stopped` with the user's sentence verbatim, then [hand back](#handing-it-back) every requirement as unobserved |
| run it | set verification `running` and follow [runtime-verification.md](references/runtime-verification.md) |
| input or substitute supplied/authorized | cover it in the same run and record the authorization verbatim |
| input declined | run the rest and mark those requirements `not observed` |

The main session must drive the real target. Never dispatch the run. It may build/start the target, drive UI/API/CLI/e2e and write only ignored evidence. It must not fix code, change tracked files, weaken checks, provision an absent dependency, or perform an unapproved destructive/external effect.

Give every spec requirement one runtime verdict: `holds`, `does not hold` or `not observed`. A substitute reaches `holds` only when its row states what it does not cover. Run observable requirements despite other missing input; for an unpredicted gap, finish the rest, ask once in the same form, then resume answered requirements. A target that cannot build or start sets verification `blocked` with the reason.

After writing the report, set `reported` and mechanically check coverage, evidence, artifacts, HEADs, clean tree and plan checksum. Re-observe or downgrade unsupported claims; never use source or diff. If every requirement holds, set verification `accepted` and plan `done`. Otherwise keep `reported`, list every non-hold and ask the user to choose: accept delivery, provide/authorize input, or request a separately approved correction round. Only explicit acceptance sets verification `accepted` and plan `done`.

## Handing it back

Hand [`using-git-worktrees`](../using-git-worktrees/SKILL.md#delivery-and-cleanup) every blocked task, standing finding and non-hold or unobserved requirement, explicitly stating when none remain.

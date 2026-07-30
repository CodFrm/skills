---
name: executing-plans
description: >-
  Use when a `.dev-kit/plans/*.yaml` plan is ready to run, and at the start of any session that finds one whose status is not `done` — including one left half-finished mid-task. Not for: a plan still `draft`.
---

# Executing a plan

**You arrive here from [`writing-plans`](../writing-plans/SKILL.md) with a `ready` plan**, or at the start of a session that found one whose `status` is not `done`.

You are the orchestrator. You hold the plan, the spec and the conversation; the work goes out to tasks and comes back as evidence you judge. Three invariants:

1. Nothing is judged finished inside the context that produced it — [the task review](#the-task-review-and-its-fix-the-second-gate-before-done), [static wrap-up](#wrap-up-two-static-reviews-at-once), then [runtime verification](#runtime-verification-a-fresh-third-subagent).
2. **Only you write the plan file.** Tasks report; you record. With parallel tasks that is not style — two agents writing one YAML file corrupt it.
3. **The loop does not stop between tasks.** A finished task is not a checkpoint.

## Before anything: read the plan whole, and the spec with it

Read the entire plan — `goal`, `context`, every task, `review`, `verification` — then the spec it points at. **The spec is what the work is measured against at the end**, and a session that never opened it cannot judge a task against anything but the plan's own words.

Resuming a half-finished plan. A task at `doing` was dispatched and never recorded: check the tree for its work first — a commit whose message matches, or the files it declared — then either move it to `reviewing` on the evidence you can see, or reset it to `todo`. A task at `reviewing` has its commit in the tree and no verdict: look for a fix commit on top of it, and with one, judge it as you would have then; without one, dispatch [the review](#the-task-review-and-its-fix-the-second-gate-before-done) again. Either way **never re-dispatch the implementer** — its code is already committed.

Resume runtime verification from its own state, not from the presence of `report.md`: `pending` follows the normal route after static review; `running` means first check whether its dispatch is still active, and otherwise inspect the partial scratch directory before sending a fresh verifier to continue and re-observe incomplete evidence; `reported` goes straight to orchestrator inspection; `accepted` goes to handing back; `blocked` goes to the user with `verification.note`. Never rerun static wrap-up merely because runtime verification was interrupted.

## The one gate

Ask once, before the first task, and only this:

```
Plan: 2026-07-30-oauth-login — 7 tasks, and 2/3/4 can run at the same time.

How should I run them?
1. Dispatch each task to a subagent  ← recommended: every task gets a clean
   context, and the three independent ones run in parallel
2. Run them inline in this session — no per-task review on this path, so the
   first reading by anyone who did not write it is at wrap-up

Worktree: I'll cut one at .dev-kit/worktrees/oauth-login — src/ has
uncommitted changes that aren't part of this round. Say so if you'd rather not.
```

One message, one question, the worktree decision stated rather than asked. Write the answer into `mode`, set `status: running`, and go. **Nothing else in this skill stops for the user by design.**

Why the worktree is decided, not asked: under a plan the round absorbs an install and the decision is usually forced anyway. Take it against [that skill's criteria](../using-git-worktrees/SKILL.md#when-to-use--when-not-to), say which way you went in one clause, and let a word from the user overturn it. Detect an existing isolated workspace first. Either way **that skill's setup is still owed, in full, before the first task**.

## The loop

```
pick every task that is ready → mark them doing → dispatch the batch
  → judge what comes back → dispatch its review, which fixes what it finds
  → judge that → record the status → full suite once the batch has landed → repeat
```

Ready means `status: todo` and every id in `deps` is `done`. Take all of them, not the first. **Dispatch the batch in parallel when their `files` are disjoint**; overlapping paths run one after another, because two agents editing one file in one workspace produce a tree neither of them tested. In `inline` mode there is no batch: one at a time in `deps` order, and [no per-task review](#the-task-review-and-its-fix-the-second-gate-before-done).

Mark every task in the batch `doing` **before** dispatching, and write the file then — that field is what a resumed session, or you after a compact, reads to find what was in flight. `reviewing` goes in the same way, when you dispatch the review rather than when it comes back. Write every status the moment you have judged it.

**Inside a task the chain continues**: [`test-driven-development`](../test-driven-development/SKILL.md) is mandatory and named in the dispatch, and where the task is a fault rather than new behaviour, [`systematic-debugging`](../systematic-debugging/SKILL.md) comes first.

Hand each task [the implementer prompt](references/task-prompts.md#implementer). Four things it must carry: the task's `goal` verbatim; the spec path plus which requirement this serves; **TDD stated as mandatory** — a subagent with no context otherwise writes the code first, the one thing that cannot be repaired later — and that it must not write the plan file or set its own status. Resolve `model`'s tier against what this harness offers; [never pass an invented id](references/prompts.md#what-every-dispatch-shares).

The implementer commits its own work, by path, and reports the SHA — you never commit on its behalf, and `git add -A` is banned in the prompt because a subagent cannot see the sibling writing into the same tree.

Parallel tasks run only their own tests. The full suite is yours, once per batch, after the batch lands — and **a batch has not landed until its reviews and their fixes have**, since a fix commit is code nobody has run the suite against.

Ask for the conclusion, not the transcript — 15 lines: status, the SHA, the evidence, concerns. **No per-task report file**: you judge the evidence as it arrives and record the outcome in the plan. The round's one durable artifact is the verification report.

### Judging what comes back

Evidence is **a command, an exit code and an observation**, checked point by point against the task's `goal`. What comes back is a report, not a verdict. This is the first of two gates: evidence that holds sends the task to [its review](#the-task-review-and-its-fix-the-second-gate-before-done); evidence that falls short never gets there.

The four statuses want four different responses — treating them alike is how a task that needed one missing fact gets abandoned:

| Status | What you do |
|---|---|
| complete | Check the evidence against the `goal` point by point. Only once it holds: `status: reviewing`, and out for review. |
| complete with concerns | Read the concerns first. Anything about correctness or scope gets resolved **before the review goes out**. A pure observation goes into `note` and waits for wrap-up. |
| missing context | Usually a hole in the plan, and cheap. Write the missing fact into `context`, then dispatch again. A fact that *contradicts* an entry already there is a collision, not a hole: that goes to the user. |
| stuck | Not enough context → fill it in and re-dispatch. Needs more reasoning → re-dispatch a tier up. Too large → split it. The plan itself is wrong → the user's call: park it `blocked`. **Never re-dispatch unchanged.** |

The normal shape is two dispatches per task: one implements, one reviews and fixes. In `inline` mode it is the round of TDD and your judgement, and nothing else.

When the evidence falls short of the `goal`, **you send it back once**, naming exactly what is missing. A second shortfall marks it `blocked` with a `note`; carry on with everything its `deps` do not gate. `missing context` and `stuck` do not spend that send-back — they are the implementer declining to guess, which is the outcome you want; what bounds them is that each re-dispatch needs something changed.

## The task review and its fix: the second gate before `done`

**A task is not `done` when its evidence holds. It is `done` when someone who did not write it has read it.** Your own judgement is over a 15-line report; the code has been read by exactly one context, the one least able to see what is wrong with it. Waiting for wrap-up to be that reader is what this buys out of: a convention broken in task 1 is copied, correctly, by every later implementer.

In `subagent` mode, dispatch it the moment that task's evidence passes, one per task, not held for the rest of the batch. It writes into that task's `files` when it fixes, so it follows the same disjointness rule. The tier is the task's own, with `mid` as the floor; wrap-up stays `strong` regardless.

Three axes, [the prompt is here](references/task-prompts.md#task-review-and-fix):

| Axis | The question |
|---|---|
| The `goal` | Is the task's own sentence observably true, and is what the spec asked of it there? |
| The project's conventions | Does this read like the project — its AGENTS.md, its `docs/testing.md`, the files around it — or like one agent's dialect? **This axis exists at task scale and nowhere else**, because it is only worth anything before the next task copies it |
| The code | Correctness, edge cases, error paths, tests that assert nothing or assert the mock, anything left in that should not ship |

**It reads the commit, by SHA — never the working tree**, which in a parallel batch holds a sibling's half-written files. `git show <sha>` is the scope.

### It reviews, then it fixes — one dispatch, both jobs

The second subagent fixes what it found itself, in the same dispatch, as a TDD round per finding committed on top of the task's commit. The context that just worked out what is wrong is the cheapest one to put it right, and **the implementer's blind spot is exactly what the review found** — sent back there, the same dialect writes the fix.

What comes back is the findings *and* the fix: every finding, and for each the test that now covers it. A report saying only that it fixed some things has handed you nothing to judge. Two things it hands back rather than fixing: a finding whose fix is a design decision rather than a correction (yours to judge, via [the three gates](../using-dev-kit/references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong)), and anything saying the plan itself is wrong (parks the task `blocked`, goes to the user).

Judge it at the same bar as the implementer's report:

1. Every finding's fix has evidence — the test that covers it, named, with its command and exit code.
2. **The fix stayed inside the findings.** Read `git show <fix sha>`: work no finding asked for is the review turning into a second implementation, and it goes back out.
3. A finding you disagree with is [let stand, not closed](#the-fix-loop-and-the-ceiling-of-three) — into the task's `note`, repeated at delivery.

Once per task. Anything blocking still open marks it `blocked`; anything smaller goes into `note` and travels to wrap-up.

In `inline` mode there is no task review — the alternative on that path is you reviewing code you just wrote, which is the absence of a review, not a degraded one. Wrap-up is then the first outside reading, which is why that pair is dispatched on every path. Say once, in the gate, what inline costs. **Say nothing about any of it in the wrap-up prompts**: "the tasks were each reviewed already" is [the verdict written into the prompt](references/prompts.md#do-not-write-the-verdict-into-either-review-prompt).

## When to stop, and when not to

Do not stop for: a task finishing, a batch finishing, a green suite, a decision you can make and justify, or a report that is merely long.

**Stop for exactly two things:** a question whose answer changes what gets built and which the spec does not settle, and anything destructive or outward-facing — a migration against real data, a deploy, anything that leaves this machine. Everything else is recorded and carried; `blocked` tasks do not stop the loop.

Four limits, and no two are the same limit:

| Limit | What it bounds | What happens at it |
|---|---|---|
| One send-back | one task whose evidence fell short | that task goes `blocked`; the loop carries on |
| [One review-and-fix dispatch](#the-task-review-and-its-fix-the-second-gate-before-done) | one task's findings | blocking left open → `blocked`; the rest → `note` |
| Two reasons above | the loop | you stop and ask; the round is still live |
| [Three rounds](#the-fix-loop-and-the-ceiling-of-three) | wrap-up's fix loop | the round stops and goes to the user |

**The three-round ceiling belongs to wrap-up alone** — there is no round counter over tasks.

## Wrap-up: two static reviews, at once

When every task is `done` or `blocked`, first check `git check-ignore -q e2e/scratch/<spec-slug>/report.md`. Where it is not ignored, add the ignore entry through the normal implementation and review path before wrap-up; the runtime verifier is forbidden to change tracked files after these reviews pass.

Then dispatch two subagents in parallel — static, read-only, disjoint outputs:

| | Reads | Asks |
|---|---|---|
| Static spec verification | the spec + the whole branch diff | Does the diff implement what the spec says? Which requirements are unmet or partly met? Is there behaviour nobody agreed to? |
| Code review | the whole branch diff | Correctness, edge cases, error handling, tests that assert nothing, dead code, security. Nothing about whether it was the right thing to build |

Prompts for both are in [wrap-up-prompts.md](references/wrap-up-prompts.md). Both go out at `strong` — this is the only reading the branch gets as a branch, so a tier chosen for cost is choosing to find fewer defects. **The task reviews do not shrink it**: the same concern solved two ways in two tasks, an interface that does not line up at both ends, what the branch adds up to whole — all invisible to a reviewer holding one commit.

Dispatch them even in `inline` mode. With nobody to dispatch to, hand the user the diff and the two prompts and say the round cannot reach runtime verification until they come back.

Keep them unmerged — one reviewer holding both questions lets the louder answer stand in for the quieter one. **Do not write the verdict into either prompt**; [prompts.md spells out the four phrases to stop on](references/prompts.md#do-not-write-the-verdict-into-either-review-prompt).

The range is `git merge-base HEAD <baseline>`, and say how many commits it covers — a range taken from where the branch happens to begin silently drops anything that landed on the baseline first. Work the baseline out rather than guessing *or* asking: `git symbolic-ref --short refs/remotes/origin/HEAD`, then `git reflog show <branch> | tail -1`.

## The fix loop, and the ceiling of three

Findings come back, you fix them as TDD rounds — the finding becomes a failing test first — and you re-run **both** reviews, because a fix on one axis breaks the other often enough to be worth it. Bump `review.round` each time.

**At three rounds with anything still open, stop.** Set `review.status: stopped` and tell the user what is open, what each round tried, and what you now think is wrong. Three passes that do not close a finding is evidence about the design; the fourth is where findings start getting argued away.

Findings deliberately let stand are fine, recorded in the task's `note` and repeated at delivery. A finding closed because you disagreed with it in your own context is not.

When both static reviews pass, set `review.status: passed`. Only then prepare runtime verification: write `verification.status: running`, its report path and the exact current HEAD into the plan **before** dispatching.

## Runtime verification: a fresh third subagent

Static reviews passing means the spec and code survive reading. Runtime verification observes whether the built result **actually does the thing**.

Dispatch one fresh, dedicated subagent at `strong` with [verification-prompt.md](references/verification-prompt.md). Do not reuse an implementer, task reviewer or static wrap-up reviewer: this verifier must arrive after the fix loop with no stake in its conclusions. It may run commands, start the application, drive UI or e2e, and write scratch scripts, evidence and the report under `e2e/scratch/<spec-slug>/`; documented ignored build/runtime artifacts are allowed only as disposable effects of those commands. With nobody to dispatch to, hand the user that prompt and say the round is not finished until its report comes back; do not verify inline.

**The report finds; it does not fix.** Anything changed underneath it is code nobody has reviewed, landing in the one document that claims everything was checked — and a step that repairs as it goes has verified its own repair. A requirement that does not hold is written down as not holding, and said out loud, going to the user [at handing back](#handing-it-back) with what you would do and what it costs. Nothing gets softened: a check weakened until it passes, a "does not hold" moved to "holds", a flow that failed recorded as "not observed" — each turns a finding into a silence, and silence reads as fine.

The verifier runs e2e when the change has a user-drivable flow and the project has a harness (init's e2e track, or Playwright / Cypress / equivalent); the evidence is then screenshots or a recording. Otherwise it uses commands and their output. It follows `docs/verification.md` where present.

The report goes to `e2e/scratch/<spec-slug>/report.md`, with `logs/`, `resources/` and, for a UI, `screenshots/` and `videos/` beside it. **Where the project has `docs/verification.md` and its report template, that format wins.** Its verdict still uses `holds` / `does not hold` / `not observed` for every spec requirement. Otherwise it has five sections:

1. Verdict — one line per spec requirement: holds / does not hold / not observed, each with how it was checked. The only place verdicts appear.
2. How it was verified — the exact steps in order.
3. Evidence — the commands and their deciding lines; screenshots or a recording each with one sentence saying what it proves (a recording comes with stills, because nobody scrubs a video).
4. Not verified — what went unobserved, and why. An unmentioned gap reads exactly like no gap.
5. Reproduce it yourself — the shortest path from a clean checkout to seeing it work. **This section is the point of the report.**

If the verifier returns a blocker or no complete report, write `verification.status: blocked` and the exact reason into `verification.note`, then stop and tell the user; do not mark it `reported`, `accepted` or plan `done`. Otherwise write `verification.status: reported` before judging the report. Open it and its evidence yourself: account for every spec requirement, check that each `holds` has a command, exit code and deciding observation, inspect linked files, and verify its before/after HEAD, clean-tree record and plan checksum. A summary is not evidence. An unsupported `holds` is a coverage gap, an observed failure is `does not hold`, and any integrity mismatch also sets `verification.status: blocked` with `verification.note` instead of `done`.

Say every non-hold, unsupported claim and unobserved requirement aloud. **Only you set `verification.status: accepted`, then plan `status: done`**, after judging coverage and evidence; here `done` means the verification round finished with its findings intact, not that every requirement holds. Then hand delivery to `using-git-worktrees`. Because the report is gitignored, put the verdict lines in the PR body too.

## Handing it back

After inspecting runtime verification and setting `status: done`, go to [`using-git-worktrees`](../using-git-worktrees/SKILL.md#delivery-and-cleanup) for delivery. Three things go over **before** the menu, because they are what the user is deciding with:

1. every spec requirement whose verdict is not "holds", and any task left `blocked`;
2. the findings let stand rather than fixed, with the reason;
3. what went unobserved.

Nothing open is also worth the line. `done` means that round finished, and **the plan does not reopen** — PR feedback is new work, and `using-git-worktrees` routes it.

## Red Flags

| Thought | Reality |
|---|---|
| "The evidence holds, so the task is `done`" | Evidence holding earns it a review. One context has read the code, and it wrote it. |
| "It came back saying it found three things and fixed them" | Then there is nothing to judge. The findings come back too, each with its test. |
| "The reviewer found it, so send the fix to the implementer" | The implementer's blind spot is exactly what the review found. |
| "Every task was reviewed, so wrap-up can be lighter — I will say so in the prompt" | A one-commit reviewer cannot see cross-task duplication, and saying it is the verdict written into the review. |
| "Verification turned up a broken requirement — I will fix it and re-run before writing this up" | Then the report verified your own repair, over code no reviewer has read. |

---
name: executing-plans
description: >-
  Use when a `.dev-kit/plans/*.yaml` plan is ready to run, and again at the start of any session that finds one whose status is not `done` — including one left half-finished by an earlier session. Not for: work with no plan yet, a plan still `draft`, or a change small enough that it never needed one.
---

# Executing a plan

You are the **orchestrator**. You hold the plan, the spec and the conversation; the work goes out to tasks and comes back as evidence you judge. Three invariants carry the whole skill:

1. **Nothing is judged finished inside the context that produced it.** An implementer reports what it ran and observed; whether that is enough is yours to decide, and the final review is dispatched to someone who did not write the code.
2. **Only you write the plan file.** Tasks report back; you record. With parallel tasks that is not a style preference — two agents writing one YAML file corrupt it.
3. **The loop does not stop between tasks.** A finished task is not a checkpoint.

## Before anything: read the plan whole, and the spec with it

Read the entire plan — `goal`, `context`, every task, `review` — not just the task you are about to run. Then read the spec it points at. **The spec is what the work is measured against at the end**, and a session that never opened it cannot judge a task against anything but the plan's own words.

Resuming a half-finished plan: a task sitting at `doing` is one an earlier session dispatched and never recorded. Check the tree for its work before re-dispatching — a commit whose message matches, or the files it declared. Then either record it `done` on the evidence you can see, or reset it to `todo` and run it again.

## The one gate

**Ask once, before the first task, and only this:**

```
Plan: 2026-07-30-oauth-login — 7 tasks, and 2/3/4 can run at the same time.

How should I run them?
1. Dispatch each task to a subagent  ← recommended: every task gets a clean
   context, and the three independent ones run in parallel
2. Run them inline in this session

Worktree: I'll cut one at .dev-kit/worktree/oauth-login — src/ has
uncommitted changes that aren't part of this round. Say so if you'd rather not.
```

One message, one question, the worktree decision **stated rather than asked**. Write the answer into `mode`, then set `status: running` and go. **Nothing else in this skill stops for the user by design.**

**Why the worktree is decided and not asked.** [`using-git-worktrees`](../using-git-worktrees/SKILL.md) asks, because for a one-off change the install cost is a fact about the user's machine that no amount of reading the repo will tell you. Under a plan that argument weakens: the round is long enough to absorb an install, and the decision is usually forced anyway. Take it yourself against [that skill's criteria](../using-git-worktrees/SKILL.md#when-to-use--when-not-to) — uncommitted unrelated changes, standing on main / master, or a plan you might throw away whole — say which way you went in one clause, and let a word from the user overturn it. **Detect an existing isolated workspace first**; being handed one already is the common case and nesting a second inside it is the expensive mistake.

Whichever way it goes, that skill's setup is still owed: the `.dev-kit` link so the workspace can see this plan at all, the install, and **the baseline suite before the first task** — a dirty baseline makes every later failure ambiguous.

## The loop

```
pick every task that is ready → dispatch the batch → record what comes back → commit → repeat
```

**Ready** means `status: todo` and every id in `deps` is `done`. Take all of them, not the first.

**Dispatch the batch in parallel when their `files` are disjoint.** Overlapping paths run one after another instead — two agents editing one file in one workspace produce a tree neither of them tested. In `inline` mode there is no batch: run them one at a time, in `deps` order.

Mark every task in the batch `doing` **before** dispatching, and write the file then. That field is what a resumed session, or you after a compact, reads to find out what was already in flight.

Hand each task [the implementer prompt](references/prompts.md#implementer). Three things it must carry, and none of them are optional: **the task's `goal` verbatim**, **the spec path plus which of its requirements this serves**, and **TDD is mandatory** — a subagent with no context will otherwise write the code first and test it afterwards, which is the one thing that cannot be repaired later. Pass `model` where the task sets one.

**Parallel tasks run only their own tests.** The full suite is yours, once per batch, after the batch lands — a sibling's half-finished tree fails a suite run for reasons that have nothing to do with the task running it.

### Judging what comes back

A task is `done` against **a command, an exit code and an observation**, checked point by point against its `goal`. Not against the implementer saying so, and not against how confident the report reads.

- **Short of the goal** → send it back once, naming exactly what is missing. **A second shortfall stops that task** — mark it `blocked` with a `note`, carry on with everything its `deps` do not gate, and raise it at the end. A third dispatch on the same task is how a session spends an hour going nowhere.
- **Off-expectation but you can settle it** — a name, a file layout, an error type nobody specified — settle it, put one line in `note`, keep going.
- **Off-expectation and you cannot settle it** — the answer changes what gets built and it is not in the spec — that is a stop. See below.

Then: **one commit per task, by path.** `git add <the task's files>`, never `git add -A` — in a parallel batch a sibling has uncommitted work in the same tree, and `-A` sweeps it into the wrong commit. No task id in the message; the plan is gitignored, so an id in the history points at nothing anyone can open.

Write `status: done` the moment you have judged it. **Not at the end of the turn** — a plan file saved up is a plan file that loses everything when the session ends.

## When to stop, and when not to

**Do not stop for:** a task finishing, a batch finishing, a green suite, a decision you can make and justify, or a report that is merely long. Between tasks you keep going.

**Stop for exactly three things:**

1. **A question whose answer changes what gets built**, and which the spec does not settle. State what you found, what you would do, and what it costs to be wrong — [the three gates](../using-dev-kit/SKILL.md#when-to-ask-the-user-look-it-up-decide-it-and-only-then-ask) apply here as everywhere: look it up first, decide it if it is cheap to reverse, ask only if it is neither.
2. **Something destructive or outward-facing** — a migration against real data, a deploy, anything that leaves this machine.
3. **The wrap-up ceiling** below.

Everything else is recorded and carried. **`blocked` tasks do not stop the loop** — they stop themselves, and you keep running whatever they do not gate.

## Wrap-up: two reviews, at once

When every task is `done` or `blocked`, **dispatch two subagents in parallel** — they are read-only and their outputs are disjoint, which is exactly the case parallelism is for:

| | Reads | Asks |
|---|---|---|
| **Spec verification** | the spec + the whole branch diff | Does this do what the spec says? Which requirements are unmet, partly met, or unobservable? Is there behaviour here nobody agreed to? |
| **Code review** | the whole branch diff | Correctness, edge cases, error handling, tests that assert nothing, dead code, security. Nothing about whether it was the right thing to build |

Prompts for both are in [prompts.md](references/prompts.md). **Dispatch them even in `inline` mode** — this is the one dispatch that buys isolation rather than context, and reviewing your own branch inside the session that wrote it provides none of it. With nobody to dispatch to, hand the user the diff and the two prompts and say the round is not finished until they come back.

The diff range is `git merge-base HEAD <baseline>`, and **say how many commits it covers** — a range taken from where the branch happens to begin silently drops anything that landed on the baseline first.

## The fix loop, and the ceiling of three

Findings come back, you fix them, you re-run **both** reviews — a fix on one axis breaks the other often enough to be worth the second pass. Every fix is a TDD round: the finding becomes a failing test first. Bump `review.round` each time you go around.

**At three rounds with anything still open, stop.** Set `review.status: stopped`, and tell the user: what is still open, what each round tried, and what you now think is wrong. Three passes that do not close a finding is evidence about the design or the requirement, not a reason to try a fourth — and the fourth is where a session starts arguing findings away instead of fixing them.

Findings you deliberately let stand are fine, and they are **recorded in the task's `note` and repeated at delivery**. What is not fine is a finding closed because you disagreed with it in your own context.

## The verification report

Reviews passing means the code is right. The report is what shows the user **it actually does the thing** — and lets them see it for themselves.

**Run e2e when the change has a user-drivable flow and the project has a harness for it** (init's e2e track, or Playwright / Cypress / equivalent already present). The evidence is then screenshots or a recording. Otherwise the evidence is commands and their output. Say which way you went and why, in one line.

The report goes to `.dev-kit/artifacts/<slug>/verification.md`. **Where the project has `docs/verification.md` and its report template** — the ones [`init`](../init/SKILL.md) generates — that format wins, and this skill does not restate it. Otherwise, five sections and nothing more:

1. **Verdict** — one line per spec requirement: holds / does not hold / not observed, each with how it was checked. This is the only place verdicts appear.
2. **How it was verified** — the exact steps in order, so the user can re-run them without reconstructing anything.
3. **Evidence** — commands with their exit codes and the lines that decide it; screenshots or a recording for a UI flow, **each with one sentence saying what it proves**. A recording comes with stills, because nobody scrubs a video.
4. **Not verified** — what went unobserved, and why. An unmentioned gap reads exactly like no gap.
5. **Reproduce it yourself** — the shortest path from a clean checkout to seeing it work: the commands, the URL, the fixture, the login. **This section is the point of the report.** A user who cannot re-run it is taking your word for it, which is what the whole chain exists to avoid.

**Screenshots and recordings live under `.dev-kit/artifacts/<slug>/`, never committed.** So does the report — which means **its verdict lines have to be said out loud too**, and put in the PR body when there is one. `.dev-kit/` does not leave this machine.

## Handing it back

Set `status: done`, then go to [`using-git-worktrees`](../using-git-worktrees/SKILL.md#delivery-and-cleanup) for delivery. Three things go over **before** the menu of options, because they are what the user is deciding with:

1. every spec requirement whose verdict is not "holds", and any task left `blocked`;
2. the findings let stand rather than fixed, with the reason;
3. what went unobserved.

**Nothing open is also worth the line.** "All 9 requirements hold, nothing left standing" and silence look identical to whoever is reading.

**`done` means that round finished, and the plan does not reopen.** PR feedback is new work and routes by size — `using-git-worktrees` owns that.

## Red Flags

| Thought | Reality |
|---|---|
| "Task done — I will check in with the user before the next one" | A finished task is not a checkpoint. The loop stops for a question that changes what gets built, something destructive, or the three-round ceiling. Nothing else. |
| "Only one task is ready, so I will run them one at a time all the way down" | Ready means `todo` with `deps` settled — take every task that qualifies, not the first. Serialising work the plan cut apart throws away what the plan was for. |
| "These two both touch `src/auth/`, but they are small — run them together" | Two agents editing one file in one workspace produce a tree neither of them tested. Disjoint `files`, or one after the other. |
| "The implementer says it is done" | It reported. You judge — against a command, an exit code and an observation, point by point against the task's `goal`. |
| "Third time lucky on this task" | Two shortfalls is the limit. Mark it `blocked`, carry on with what it does not gate, raise it at the end. |
| "`git add -A` and commit" | In a parallel batch that sweeps a sibling's half-finished work into this task's commit. Commit the task's declared files by path. |
| "I will write the plan file once at the end of the turn" | Then a session that ends early loses every status it learned. Write it the moment a status changes. |
| "Let the subagents update their own task status" | Concurrent writes to one YAML file. They report; you record. |
| "The task did not say TDD explicitly, but the implementer knows" | A subagent with no context writes the code first. Tests added afterwards are green on the first run, which proves nothing. Put it in the prompt every time. |
| "I wrote this branch, I can review it" | The one dispatch that buys isolation rather than context. Reviewing your own diff in the context that produced it is not a degraded review, it is the absence of one. |
| "Round four will get it" | Three rounds that do not close a finding is evidence about the design. Round four is where findings start getting argued away instead of fixed. |
| "The reviewer is wrong about this one" | Then that is a finding let stand, with the reason recorded and repeated at delivery — not a finding closed. |
| "The plan came out different, I will tidy it to match" | A plan edited into agreement with the code records nothing. Say what changed, then change it deliberately, per [`writing-plans`](../writing-plans/SKILL.md). |
| "Tests are green, that is the verification report" | Green says the code does what its tests say. The report says it does what the *spec* says, and shows the user how to see it themselves. |
| "The report is in `.dev-kit/artifacts/`, they can open it" | `.dev-kit/` is gitignored and never leaves this machine. Say the verdicts out loud, and put them in the PR body. |

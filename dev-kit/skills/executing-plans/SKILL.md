---
name: executing-plans
description: >-
  Use when a `.dev-kit/plans/*.yaml` plan is ready to run, and again at the start of any session that finds one whose status is not `done` — including one left half-finished by an earlier session. Not for: work with no plan yet, a plan still `draft`, or a change small enough that it never needed one.
---

# Executing a plan

You are the **orchestrator**. You hold the plan, the spec and the conversation; the work goes out to tasks and comes back as evidence you judge. Three invariants carry the whole skill:

1. **Nothing is judged finished inside the context that produced it.** An implementer reports what it ran and observed; whether that is enough is yours to decide. **In `subagent` mode every task's commit is then read by a reviewer that did not write it**, and on every path the branch is read again as a whole at wrap-up.
2. **Only you write the plan file.** Tasks report back; you record. With parallel tasks that is not a style preference — two agents writing one YAML file corrupt it.
3. **The loop does not stop between tasks.** A finished task is not a checkpoint.

## Before anything: read the plan whole, and the spec with it

Read the entire plan — `goal`, `context`, every task, `review` — not just the task you are about to run. Then read the spec it points at. **The spec is what the work is measured against at the end**, and a session that never opened it cannot judge a task against anything but the plan's own words.

Resuming a half-finished plan: a task sitting at `doing` is one an earlier session dispatched and never recorded. Check the tree for its work before re-dispatching — a commit whose message matches, or the files it declared. Then either move it on to `reviewing` on the evidence you can see, or reset it to `todo` and run it again.

**A task at `reviewing` has its commit in the tree and no verdict recorded.** Look for a fix commit on top of it: with one, judge that as you would have then; without one, dispatch [the review](#the-task-review-and-its-fix-the-second-gate-before-done) again. Either way **never re-dispatch the implementer** — its code is already committed, and a second one sent at it writes it twice.

## The one gate

**Ask once, before the first task, and only this:**

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

One message, one question, the worktree decision **stated rather than asked**. Write the answer into `mode`, then set `status: running` and go. **Nothing else in this skill stops for the user by design.**

**Why the worktree is decided and not asked.** [`using-git-worktrees`](../using-git-worktrees/SKILL.md) asks, because for a one-off change the install cost is a fact about the user's machine that no amount of reading the repo will tell you. Under a plan that argument weakens: the round is long enough to absorb an install, and the decision is usually forced anyway. Take it yourself against [that skill's criteria](../using-git-worktrees/SKILL.md#when-to-use--when-not-to) — uncommitted unrelated changes, standing on main / master, or a plan you might throw away whole — say which way you went in one clause, and let a word from the user overturn it. **Detect an existing isolated workspace first**; being handed one already is the common case and nesting a second inside it is the expensive mistake.

Whichever way it goes, that skill's setup is still owed: the `.dev-kit` link so the workspace can see this plan at all, the install, and **the baseline suite before the first task** — a dirty baseline makes every later failure ambiguous.

## The loop

```
pick every task that is ready → mark them doing → dispatch the batch
  → judge what comes back → dispatch its review, which fixes what it finds
  → judge that → record the status → full suite once the batch has landed → repeat
```

The implementer commits its own task; you never commit on its behalf.

**Ready** means `status: todo` and every id in `deps` is `done`. Take all of them, not the first.

**Dispatch the batch in parallel when their `files` are disjoint.** Overlapping paths run one after another instead — two agents editing one file in one workspace produce a tree neither of them tested. In `inline` mode there is no batch — run them one at a time, in `deps` order — and [no per-task review either](#the-task-review-and-its-fix-the-second-gate-before-done).

Mark every task in the batch `doing` **before** dispatching, and write the file then. That field is what a resumed session, or you after a compact, reads to find out what was already in flight. **`reviewing` goes in the same way** — written when you dispatch the review, before it comes back.

Hand each task [the implementer prompt](references/prompts.md#implementer). Four things it must carry, none of them optional: **the task's `goal` verbatim**, **the spec path plus which of its requirements this serves**, **TDD stated as mandatory** — a subagent with no context will otherwise write the code first and test it afterwards, which is the one thing that cannot be repaired later — and **that it must not write the plan file or set its own status**. Resolve `model`'s tier against what this harness offers; [never pass an invented id](references/prompts.md#what-every-dispatch-shares).

**Parallel tasks run only their own tests.** The full suite is yours, once per batch, after the batch lands — a sibling's half-finished tree fails a suite run for reasons that have nothing to do with the task running it. **A batch has not landed until its reviews and their fixes have**, so that is where the suite goes: a fix commit is code nobody has run the whole suite against.

**The implementer commits its own work, by path, and reports the SHA.** It knows what it touched; you do not, beyond what `files` declared. `git add -A` is banned in the prompt for a reason that a subagent cannot see for itself: it has no way of knowing a sibling task is writing into the same tree beside it.

**Ask for the conclusion, not the transcript** — 15 lines: status, the SHA, the commands with their exit codes, what was observed, concerns. **A dispatch that hands back everything it read has bought you nothing**; the context you were protecting is spent anyway, and you may as well have run it inline. **No per-task report file.** You judge the evidence as it arrives and record the outcome in the plan, so a file would be written and never read again — the round's one durable artifact is the verification report at the end.

### Judging what comes back

Evidence is **a command, an exit code and an observation**, checked point by point against the task's `goal` — not the implementer saying so, and not how confident the report reads. **What comes back is a report, not a verdict.** A report claiming the goal now holds without naming the command and its exit code has not shown it.

**This is the first of two gates, not the last.** Evidence that holds sends the task to [its review](#the-task-review-and-its-fix-the-second-gate-before-done); evidence that falls short never gets there.

The implementer returns one of four statuses, and they are not four flavours of failure — **they want four different responses**, and treating them alike is how a task that needed one missing fact gets abandoned:

| Status | What you do |
|---|---|
| **complete** | Check the evidence against the `goal` point by point. Only once it holds: `status: reviewing`, and out it goes for review. |
| **complete with concerns** | Read the concerns first. Anything about correctness or scope gets resolved **before the review goes out** — a reviewer spending its one pass on a problem the implementer already named buys you nothing. A pure observation ("this file is getting large") goes into `note` and waits for wrap-up. |
| **missing context** | **Usually a hole in the plan, and cheap.** Write the missing fact into the plan's `context`, then dispatch again — it will not be missing next time. A fact that *contradicts* an entry already there is not a hole but a collision: that one goes to the user. |
| **stuck** | Work out which kind. Not enough context → fill it in and re-dispatch. Needs more reasoning → **re-dispatch a tier up**, not again at the same one. Task too large → split it, which is yours to do. **The plan itself is wrong → that is the user's call**: park it `blocked` and take it to them. **Never re-dispatch unchanged** — it already told you that path does not work. |

**The normal shape is two dispatches: one implements, one reviews and fixes what it found.** The implementer does one round of TDD, which is what cutting the task as a vertical slice was for; the review is the second dispatch and does both jobs in one go. **Two subagents per task** — anything more is the exception, and the two paragraphs below are what bound it. **In `inline` mode it is the round of TDD and your judgement, and nothing else**: that path has no task review.

**When the evidence falls short of the `goal`, you send it back once**, naming exactly what is missing. **A second shortfall marks it `blocked`** with a `note`; carry on with everything its `deps` do not gate, and raise it at the end. A third dispatch on the same task is how a session spends an hour going nowhere.

**`missing context` and `stuck` do not spend that send-back.** They are not shortfalls — they are the implementer stopping instead of guessing, which is the outcome you want, and charging for it would make the cheapest good result the one that gets punished. What limits those is the rule above them: **never re-dispatch unchanged.** Each attempt needs a fact filled in, a tier up, or a split, and when there is nothing left to change, that is the plan being wrong and the user's call.

Write the status **the moment you have judged it**. Not at the end of the turn — a plan file saved up is a plan file that loses everything when the session ends.

## The task review and its fix: the second gate before `done`

**A task is not `done` when its evidence holds. It is `done` when someone who did not write it has read it.** Your own judgement is over a 15-line report; the code itself has been read by exactly one context, the one that wrote it, and that is the context least able to see what is wrong with it.

Waiting for wrap-up to be that reader is what this step buys out of. A convention broken in task 1 is a convention broken in tasks 2 through 6 by the time anyone looks — every later implementer reads the code around it and copies it, correctly, because matching the surrounding code is what it was told to do. **A finding is cheapest in the commit that introduced it and most expensive after five tasks have built on it.**

**In `subagent` mode, dispatch it the moment that task's evidence passes**, one per task, and do not hold it for the rest of the batch. It writes into that task's `files` when it fixes, so it follows the same disjointness rule the task did — not alongside a sibling whose paths overlap.

**The tier is the task's own, with `mid` as the floor.** It reads one commit against one goal, which is a smaller job than wrap-up's; wrap-up stays `strong` regardless.

**Three axes, [the prompt is here](references/prompts.md#task-review-and-fix):**

| Axis | The question |
|---|---|
| **The `goal`** | Is the task's own sentence observably true, and is what the spec asked of it there? This is the second, independent check on the thing you just judged from a report |
| **The project's conventions** | Does this read like the project — its AGENTS.md, its `docs/testing.md`, the patterns in the files around it — or like one agent's dialect dropped in? **This axis exists at task scale and nowhere else**, because it is only worth anything before the next task copies it |
| **The code** | Correctness, edge cases, error paths, tests that assert nothing or assert the mock, anything left in that should not ship |

**It reads the commit, by SHA — never the working tree.** In a parallel batch the tree holds a sibling's half-written files, and a reviewer reading those reports findings against code that is nobody's business but another task's. `git show <sha>` is the scope.

### It reviews, then it fixes — one dispatch, both jobs

**The second subagent fixes what it found itself**, in the same dispatch, as a TDD round per finding committed on top of the task's own commit. Nothing comes back to you in between: the context that just worked out what is wrong here is the cheapest one to put it right, and **the implementer's blind spot is exactly what the review found** — sent back there, the same dialect writes the fix. The implementer is finished when its commit lands.

**What comes back is the findings *and* the fix**: every finding it raised, and for each the test that now covers it. A report saying only that it fixed some things has handed you nothing to judge — and the two things it hands back rather than fixing are **a finding whose fix is a design decision rather than a correction**, and **anything saying the plan itself is wrong**. The first is yours to judge, the second parks the task `blocked` and goes to the user.

**Judging what comes back is the same bar as the implementer's report, over four things:**

1. **Every finding's fix has evidence** — the test that now covers it, named, with the command and its exit code. "Fixed" with no test behind it is a claim, exactly as it was at the first gate.
2. **The fix stayed inside the findings.** Read `git show <fix sha>`: work in there that no finding asked for is the review turning into a second implementation, and it goes back out or gets reverted.
3. **The two it handed back get handled, not filed.** A fix that is a design decision is yours to take — [the three gates](../using-dev-kit/SKILL.md#when-to-ask-the-user-look-it-up-decide-it-and-only-then-ask) decide whether you settle it or the user does. "The plan is wrong" parks the task `blocked` and goes to the user.
4. **A finding you disagree with is [let stand, not closed](#the-fix-loop-and-the-ceiling-of-three)** — into the task's `note`, repeated at delivery. Disagreeing with it in your own context is not a verdict on it.

**Once per task.** Anything blocking still open marks the task `blocked` with a `note`, and the loop carries on with whatever it does not gate; anything smaller goes into `note` and travels to wrap-up. **A second review pass on one task is buying wrap-up's coverage twice** — the branch gets read whole in a few tasks' time, and that pass sees both commits anyway.

**In `inline` mode there is no task review.** Inline means the user asked for no subagents, and the alternative on that path is you reviewing code you just wrote, which is [not a degraded review but the absence of one](#red-flags). So the inline loop stays what it was — the round of TDD and your judgement of the evidence — and **the first reading by anyone who did not write it is wrap-up's**, which is why that pair is dispatched on every path. Say once, in the gate, that this is what inline costs.

**Say nothing about it in the wrap-up prompts.** "The tasks were each reviewed already" is [the verdict written into the prompt](references/prompts.md#do-not-write-the-verdict-into-either-review-prompt), and it is the reviewer's one advantage you would be spending.

## When to stop, and when not to

**Do not stop for:** a task finishing, a batch finishing, a green suite, a decision you can make and justify, or a report that is merely long. Between tasks you keep going.

**Stop for exactly two things:**

1. **A question whose answer changes what gets built**, and which the spec does not settle. State what you found, what you would do, and what it costs to be wrong — [the three gates](../using-dev-kit/SKILL.md#when-to-ask-the-user-look-it-up-decide-it-and-only-then-ask) apply here as everywhere: look it up first, decide it if it is cheap to reverse, ask only if it is neither.
2. **Something destructive or outward-facing** — a migration against real data, a deploy, anything that leaves this machine.

Everything else is recorded and carried. **`blocked` tasks do not stop the loop** — they stop themselves, and you keep running whatever they do not gate.

**Four limits, and no two of them are the same limit** — mixing them up is how a loop stops for something that was never meant to stop it:

| Limit | What it bounds | What happens at it |
|---|---|---|
| **One send-back** | one task whose evidence fell short | that task goes `blocked`; **the loop carries on** |
| **[One review-and-fix dispatch](#the-task-review-and-its-fix-the-second-gate-before-done)** | one task's findings | blocking left open → `blocked`; the rest → `note`, carried to wrap-up |
| **Two reasons above** | the loop | you stop and ask; the round is still live |
| **[Three rounds](#the-fix-loop-and-the-ceiling-of-three)** | wrap-up's fix loop | the round stops and goes to the user |

**The three-round ceiling belongs to wrap-up alone.** It counts review-and-fix passes after every task is finished, and it has nothing to say about the task loop — there is no round counter over tasks, and no number of finished tasks that is a reason to pause.

## Wrap-up: two reviews, at once

When every task is `done` or `blocked`, **dispatch two subagents in parallel** — they are read-only and their outputs are disjoint, which is exactly the case parallelism is for:

| | Reads | Asks |
|---|---|---|
| **Spec verification** | the spec + the whole branch diff | Does this do what the spec says? Which requirements are unmet, partly met, or unobservable? Is there behaviour here nobody agreed to? |
| **Code review** | the whole branch diff | Correctness, edge cases, error handling, tests that assert nothing, dead code, security. Nothing about whether it was the right thing to build |

Prompts for both are in [prompts.md](references/prompts.md). **Both go out at the `strong` tier** — this is the only reading the branch gets as a branch, so it is the one dispatch in the round not to economise on, and a tier chosen for cost here is choosing to find fewer defects.

**The task reviews do not shrink this.** What each of them could not see is exactly what wrap-up is for: the same concern solved two different ways in two tasks, an interface that does not line up at both ends, a duplicate implementation, what the branch adds up to taken whole. Every one of those is invisible to a reviewer holding one commit, however carefully it read it.

**Dispatch them even in `inline` mode** — this is the dispatch that buys isolation rather than context, and reviewing your own branch inside the session that wrote it provides none of it. On the inline path it is also **the only outside reading this code gets at all**, since that path has no task reviews, so it is the last place to economise. With nobody to dispatch to, hand the user the diff and the two prompts and say the round is not finished until they come back.

**Keep them unmerged.** They answer different questions, and a single reviewer holding both lets the louder answer stand in for the quieter one. Two files, two sets of findings, no combined ranking.

**Do not write the verdict into either prompt.** Nothing you send tells a reviewer what it may not raise — [prompts.md spells out the four phrases to stop on](references/prompts.md#do-not-write-the-verdict-into-either-review-prompt). Bounding the method is legitimate; bounding the conclusion is sparing yourself a fix.

The diff range is `git merge-base HEAD <baseline>`, and **say how many commits it covers** — a range taken from where the branch happens to begin silently drops anything that landed on the baseline first. Work the baseline out rather than guessing *or* asking: `git symbolic-ref --short refs/remotes/origin/HEAD` for the remote's default, `git reflog show <branch> | tail -1` for where this branch was cut. Get it wrong and the reviewers are reading a pile of somebody else's changes.

## The fix loop, and the ceiling of three

Findings come back, you fix them, you re-run **both** reviews — a fix on one axis breaks the other often enough to be worth the second pass. Every fix is a TDD round: the finding becomes a failing test first. Bump `review.round` each time you go around.

**At three rounds with anything still open, stop.** Set `review.status: stopped`, and tell the user: what is still open, what each round tried, and what you now think is wrong. Three passes that do not close a finding is evidence about the design or the requirement, not a reason to try a fourth — and the fourth is where a session starts arguing findings away instead of fixing them.

Findings you deliberately let stand are fine, and they are **recorded in the task's `note` and repeated at delivery**. What is not fine is a finding closed because you disagreed with it in your own context.

## The verification report

Reviews passing means the code is right. The report is what shows the user **it actually does the thing** — and lets them see it for themselves.

**The report finds; it does not fix.** By the time you are writing it the fix loop has settled and both reviewers have read the branch, so anything changed underneath the report is code nobody has reviewed, landing in the one document that claims everything was checked. And a step that repairs as it goes has verified its own repair — [the same reason both wrap-up reviewers are read-only](references/prompts.md#spec-verification). Drive it, write down what happened, stop.

**A requirement that does not hold is written down as not holding, and said out loud.** That verdict — and any flow you could not drive at all — goes to the user [at handing back](#handing-it-back), with what you would do about it and what it costs. Whether the round reopens for it is theirs to decide knowing that — it is still live until you set `status: done` — and not a repair you slip in on the way to reporting it green. The third option is the one that is never available: patch it quietly and write up the re-run as though the first run had passed.

**Nothing gets softened to close the gap between what you saw and what the report says.** A check weakened until it passes, a "does not hold" moved to "holds" because the fix looks obvious, a flow that failed recorded as "not observed" — each of those turns a finding into a silence, and a silence is what the user reads as fine.

**Run e2e when the change has a user-drivable flow and the project has a harness for it** (init's e2e track, or Playwright / Cypress / equivalent already present). The evidence is then screenshots or a recording. Otherwise the evidence is commands and their output. Say which way you went and why, in one line.

**It goes to `e2e/scratch/<spec-slug>/report.md`** — one directory, on this round's own slug, with `logs/`, `resources/` and, for a UI, `screenshots/` and `videos/` beside it. **One home, whatever the project looks like.** Verification evidence is one kind of thing and belongs in one place; a report that moves depending on which docs a project happens to have is one nobody can find without checking first.

**Where the project has `docs/verification.md` and its report template** — the ones [`init`](../init/SKILL.md) generates — **that format wins and this skill does not restate it.** The location is already the same, so there is nothing to reconcile.

**Where it does not, keep the directory and use five sections, nothing more:**

1. **Verdict** — one line per spec requirement: holds / does not hold / not observed, each with how it was checked. This is the only place verdicts appear.
2. **How it was verified** — the exact steps in order, so the user can re-run them without reconstructing anything.
3. **Evidence** — commands with their exit codes and the lines that decide it; screenshots or a recording for a UI flow, **each with one sentence saying what it proves**. A recording comes with stills, because nobody scrubs a video.
4. **Not verified** — what went unobserved, and why. An unmentioned gap reads exactly like no gap.
5. **Reproduce it yourself** — the shortest path from a clean checkout to seeing it work: the commands, the URL, the fixture, the login. **This section is the point of the report.** A user who cannot re-run it is taking your word for it, which is what the whole chain exists to avoid.

**Screenshots and recordings sit beside the report, and none of it is committed.** Check `e2e/scratch/` is actually ignored before writing there — `git check-ignore -q e2e/scratch`, and where it is not, **add the line and commit that change first**, exactly as for the worktree location. A project `init` has run already has it; one it has not may put the whole evidence tree into `git status`.

Because it is gitignored, **the verdict lines have to be said out loud** as well, and put in the PR body when there is one. The report does not leave this machine.

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
| "Task done — I will check in with the user before the next one" | A finished task is not a checkpoint. The loop stops for a question that changes what gets built, or for something destructive. Nothing else. |
| "That is three tasks now, time to stop and review" | There is no round counter over tasks. Three is wrap-up's ceiling on fix passes, after every task is done — it says nothing about how many tasks run before you get there. |
| "Only one task is ready, so I will run them one at a time all the way down" | Ready means `todo` with `deps` settled — take every task that qualifies, not the first. Serialising work the plan cut apart throws away what the plan was for. |
| "These two both touch `src/auth/`, but they are small — run them together" | Two agents editing one file in one workspace produce a tree neither of them tested. Disjoint `files`, or one after the other. |
| "The implementer says it is done" | It reported. You judge — against a command, an exit code and an observation, point by point against the task's `goal`. |
| "The evidence holds, so the task is `done`" | Evidence holding is what earns the task a review, not what closes it. So far the code has been read by one context, and that is the one that wrote it. |
| "I will hold the reviews and send them all at the end of the batch" | Held back, a review only delays a task nothing else depends on. Dispatch each one the moment its task's evidence passes. |
| "The reviewer can read the working tree, same diff" | Not in a parallel batch it is not — the tree holds a sibling's half-written files, and findings against those are noise about somebody else's task. Review the commit: `git show <sha>`. |
| "It came back saying it found three things and fixed them" | Then there is nothing to judge. The findings come back too, each with the test that now covers it — a fix you cannot see is a claim. |
| "The findings are small, I will fix them here myself" | The dispatch that found them fixes them, with a failing test each. Doing it in your own context puts the code back in the hands that judged it. |
| "The reviewer found it, so send the fix to the implementer" | The implementer's blind spot is exactly what the review found, and every finding would have to be re-explained. It stays with the context that just worked out what right looks like here. |
| "It tidied a few other things while it was in there — no harm" | No finding asked for them, so nobody judged them and no test covers them. That is the review becoming a second implementation: revert that part or send it back. |
| "It fixed what it found — someone else should check that fix" | One review pass per task. The checking read is wrap-up's, over the whole branch, and it sees both commits there anyway. |
| "Every task was reviewed already, so wrap-up can be lighter — I will say so in the prompt" | Wrong twice over. A one-commit reviewer cannot see duplicate implementations or an interface that does not line up, which is what wrap-up is for; and saying it in the prompt is the verdict written into the review. |
| "Inline mode has no task review, so I will read each diff myself instead" | Then the context that wrote it is the one clearing it, which is the thing the gate existed to prevent. Inline has no task review at all: judge the evidence as ever, and let wrap-up be the first outside reading. |
| "It came back `stuck`, so send it out again" | It already told you that path does not work. Something has to change first: a fact filled in, a tier up, a split, or the user's call. Re-dispatching unchanged is asking the same question twice. |
| "`missing context` means the task failed" | It means the plan had a hole and the implementer stopped instead of guessing, which is the cheapest outcome available. Write the fact into `context` and send it back. |
| "Third time lucky on this task" | One send-back is the limit on a shortfall. Mark it `blocked`, carry on with what it does not gate, raise it at the end. |
| "It came back `missing context` twice, so it is out of chances" | Nothing was spent — that is not a shortfall, it is the implementer declining to guess. What bounds it is that each re-dispatch needs something changed; run out of changes and the plan is wrong, which is the user's call. |
| "`git add -A` and commit" | In a parallel batch that sweeps a sibling's half-finished work into this task's commit. The prompt bans it because a subagent cannot see the sibling for itself. |
| "The subagent came back with everything it read, right here" | Then you paid for its whole transcript and dispatching bought you nothing. Ask for the conclusion — the commands, the exit codes, the findings — and nothing about how it got there. |
| "I should file each task's report somewhere for the record" | Nothing reads it afterwards: you judge the evidence as it arrives and the plan records the outcome. The round has one durable artifact, and it is the verification report. |
| "I will tell the reviewer that bit was deliberate, to save it flagging it" | That is writing the verdict into the prompt — and it holds for a task review as much as for wrap-up's pair. You are spending the reviewer's one advantage: it was not there when the code was written. |
| "Same model for every task, simpler" | Wrong in both directions at once: the easy tasks overpay and the hard one goes out underpowered. Read the tier off each task line. |
| "I will write the plan file once at the end of the turn" | Then a session that ends early loses every status it learned. Write it the moment a status changes. |
| "Let the subagents update their own task status" | Concurrent writes to one YAML file. They report; you record. |
| "The task did not say TDD explicitly, but the implementer knows" | A subagent with no context writes the code first. Tests added afterwards are green on the first run, which proves nothing. Put it in the prompt every time. |
| "I wrote this branch, I can review it" | Review is the dispatch that buys isolation rather than context. Reviewing your own diff in the context that produced it is not a degraded review, it is the absence of one. |
| "Round four will get it" | Three rounds that do not close a finding is evidence about the design. Round four is where findings start getting argued away instead of fixed. |
| "The reviewer is wrong about this one" | Then that is a finding let stand, with the reason recorded and repeated at delivery — not a finding closed. |
| "The plan came out different, I will tidy it to match" | A plan edited into agreement with the code records nothing. Say what changed, then change it deliberately, per [`writing-plans`](../writing-plans/SKILL.md). |
| "Tests are green, that is the verification report" | Green says the code does what its tests say. The report says it does what the *spec* says, and shows the user how to see it themselves. |
| "Verification turned up a broken requirement — I will fix it and re-run before writing this up" | Then the report verified your own repair, over code no reviewer has read. The report finds and does not fix: write the verdict as it fell out, say it out loud, and let the user decide whether the round reopens. |
| "It nearly works, so I will call that one 'not observed' rather than 'does not hold'" | "Not observed" means nobody looked. You looked and it failed — filing that as a gap turns a finding into a silence, and the user reads silence as fine. |
| "The report is in `.dev-kit/artifacts/`, they can open it" | `.dev-kit/` is gitignored and never leaves this machine. Say the verdicts out loud, and put them in the PR body. |

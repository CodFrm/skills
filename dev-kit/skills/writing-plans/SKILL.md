---
name: writing-plans
description: >-
  Use once a spec is approved and the change breaks into more than about three steps or spans sessions, and again when work under way decomposes differently than planned. Writes `.dev-kit/plans/<slug>.yaml`. Not for: settling what to build — that is the spec, and it comes first.
---

# Writing a plan

**You arrive here from [`brainstorming`](../brainstorming/SKILL.md) inside the round's workspace, with an approved spec committed on its branch** and a change that broke into more than about three steps. With no spec, go back there first.

**The spec settles what to build. The plan settles how — and nothing else.** A requirement written into a plan is a requirement in two documents with nothing keeping them equal, and the plan is the copy nobody commits. So the plan carries **route, order and state**. When someone asks "what must this do", the answer is the spec, every time.

**A plan is a working file, not a document**: `.dev-kit/plans/*.yaml`, gitignored, read by whoever runs the next task — possibly another session, possibly a subagent with no memory of this conversation.

## One slug for everything

The plan takes the spec's own slug, [which `brainstorming` fixed](../brainstorming/SKILL.md#file-naming) and which every path in the round follows:

```
docs/specs/2026-07-30-oauth-login.md        the spec
.dev-kit/plans/2026-07-30-oauth-login.yaml  the plan
.dev-kit/artifacts/2026-07-30-oauth-login/  mockups
e2e/scratch/2026-07-30-oauth-login/         the verification report and its evidence
oauth-login / feat/oauth-login              worktree directory / branch
```

**Never invent a second name.**

## Check the ground first

**Every fact in the plan is one you verified, with a `file:line` behind it.** A plan built on what you assume the code does stops matching reality at task two, and the one who finds out is a subagent with no way to check.

Read before you write: the spec in full, the modules it touches, their existing tests, and how this project already does the thing you are about to do again. Where the surface is wide, dispatch that reading — one module each, reporting back "conclusion + `file:line`".

## The file

```yaml
spec: docs/specs/2026-07-30-oauth-login.md   # required — a change this size owes a spec
status: draft            # draft → ready → running → done | stopped
mode: null               # subagent | inline — the ready gate writes it from the user's answer
worktree: .dev-kit/worktrees/oauth-login  # path, or "none: <reason>" — record the workspace already created

goal: >-
  One sentence: what is observably true once every task is done. Not a summary of
  the spec — the finish line, so a resumed session knows what it is aiming at.

context:                 # facts the plan rests on. Each one verified, each with a file:line
  - "Sessions are issued at src/auth/session.ts:42, and only ever read from the cookie"
  - "No refresh path exists anywhere: `git grep -n refresh_token` returns nothing"

tasks:
  - id: 1
    goal: >-
      One observable sentence. "Given an expired token, calling refresh() returns a
      new session rather than 401." This is what the implementer makes true.
    deps: []                    # ids that must be done first. [] means it can start now
    files: [src/auth/]          # what it expects to touch — this is the parallelism check
    model: null                 # cheap | mid | strong — a tier, not an id. See below
    interfaces: null            # names and types this task produces that a later one consumes
    status: todo                # todo → doing → reviewing → done | blocked
    note: null                  # blocked, done came out different, or a finding let stand

  - id: 2
    goal: ...
    deps: [1]
    files: [src/auth/session.ts, tests/auth/session.test.ts]
    interfaces: "consumes refreshSession(token: string): Session from task 1"
    status: todo

review:                  # wrap-up state, so a resumed session knows where it stands
  round: 0               # fix rounds spent; three is the ceiling
  status: pending        # pending → passed | stopped

verification:            # runtime-verifier state; executing-plans writes every field
  status: pending        # pending → running → reported → accepted | blocked
  report: null           # e2e/scratch/<spec-slug>/report.md once dispatched
  head: null             # exact reviewed HEAD the verifier must run
  note: null             # interruption or blocker; never a softened verdict
```

**`files` is load-bearing, not documentation.** It is what lets two ready tasks be dispatched at once; overlapping paths run one after the other instead. Guess it wide rather than narrow.

**`reviewing` is a state, not a formality.** A task whose commit is in the tree and whose [review and fix](../executing-plans/SKILL.md#the-task-review-and-its-fix-the-second-gate-before-done) have not finished sits there, so a resumed session re-dispatches the review instead of sending an implementer at code that is already written. A plan run `inline` has no per-task review, so its tasks go from `doing` straight to `done`.

**`verification` survives an interrupted final run.** `running` means a verifier was dispatched but its report has not been accepted; `reported` means its output returned and still needs the orchestrator's inspection. Only that inspection writes `accepted`. A resumed session never infers completion from a report file alone.

**`interfaces` is where a signature crosses a task boundary** — that name and its type go on the *consuming* task's line, **not into the dispatch prompt**, because a fact typed only into a prompt is the class of fact a compaction destroys while the plan survives. `null` where nothing crosses.

## Cutting the tasks

**A task is a vertical slice: one complete capability, one fresh context window, one whole RED→GREEN→REFACTOR round.**

- **Never cut by layer.** "Write the tests" is not a task, and neither is "add the types" — both leave something nobody can observe and a round of TDD split across two contexts.
- **One sentence of observable outcome each.** Two sentences that will not reduce to one are two tasks. Not being able to write the sentence means the slice is not understood yet.
- **Size it to one context window.** A task a subagent cannot finish without exploring the whole repository was cut too big.
- **`deps` is the only ordering** — the executor picks by `deps`, never by list order.

**Aim for parallelism where the work genuinely splits, and do not manufacture it.** Three tasks that all edit one file are one task wearing three hats.

## Choosing a model: a tier, never an id

**`model` names one of three relative tiers — `cheap`, `mid`, `strong` — resolved by the executor against whatever the harness offers at dispatch time. Never write a model id into the plan**: one the harness lacks either fails the dispatch or silently falls back to something nobody chose.

Read the tier off the task's own text — how much of the *how* is already written down:

| What the task looks like | Tier |
|---|---|
| Already says how: names the file, the command, the pattern to copy | `cheap` |
| Cross-file coordination, following an existing pattern, investigating a fault | `mid` |
| Design judgement, or a large stretch of code to read before a line can be written | `strong` |

**Pick per task, not once for the round.** One tier for all of them either pays the hard task's price ten times over or sends the hard task out underpowered.

**Rounds cost more than unit price** — the cheapest tier often burns two or three attempts on a task `mid` finishes in one. So `cheap`'s floor is narrow: follow the task text and run the tests. **Anything requiring the implementer to work something out starts at `mid`.** `null` inherits the session's model, usually the most expensive tier there is.

## The gate, then freeze

**A `draft` plan is not something to work from.** One message puts two things to the user — how the work is cut, and how it gets run — and nothing starts until both come back. They are ruling on how the work is cut, not re-approving what it does.

Resolve the current harness through [`using-dev-kit`'s platform mapping](../using-dev-kit/SKILL.md#platform-tools) before offering `subagent`; where it has no native dispatch tool, offer only `inline`.

```
Plan: 2026-07-30-oauth-login — 7 tasks; 2/3/4 can run at the same time.
Workspace: .dev-kit/worktrees/oauth-login already holds this round; the spec
is committed on its branch.

  1 · <goal>   deps: []
  2 · <goal>   deps: [1]
  ...

Two things, then I start:

A. The breakdown above — veto anything cut wrong.
B. How should I run it?
   1. Dispatch each task to a subagent  ← recommended: every task gets a clean
      context, and the three independent ones run in parallel
   2. Run them inline in this session — no per-task review, and wrap-up's two
      reviews and the runtime verification run here too, so no context but mine
      ever reads this code
```

Write both answers in together: `status: ready` and `mode`. **Neither is yours to guess** — the only `mode` you set without asking is the `inline` the harness mapping forces. A breakdown sent back to be re-cut gets the whole message again, because which tasks run at once is what option 1 was recommended on.

**Once `ready`, what is frozen is the shape of the work — not the file:**

| Written during execution | Frozen until the user re-cuts it |
|---|---|
| **State** — `status` (plan and task), `note`, `mode`, `worktree`, `review`, `verification` | `goal`, and each task's `goal`, `deps`, `files`, `model` |
| **Facts discovered** — appended to `context`, and to a task's `interfaces` | |

**Facts accrete; the shape of the work does not.** A task coming back `missing context` has usually found something true nobody had written down — that goes into `context`, which is finishing the plan, not editing it. **A fact that contradicts an entry already there is a collision, not a hole**, and it goes to the user.

**When the plan turns out to be wrong, say so and change it deliberately** — a slice that will not decompose the way you cut it, a dependency nobody saw, a task the spec does not require. What is not allowed is editing it quietly so it agrees with what already happened. **The spec is frozen harder**: if the requirement itself was wrong, that goes back through [`brainstorming`](../brainstorming/SKILL.md) and the user, not into the plan and not into the code.

**Once `status: ready`, hand over to [`executing-plans`](../executing-plans/SKILL.md)** — do not start on task 1 here.

## Checklist

- [ ] `spec:` points at an approved spec committed on this branch, the plan's slug is that spec's slug, and `worktree` records the workspace already holding both
- [ ] Every entry in `context` was verified just now and carries a `file:line` or a command
- [ ] No requirement is stated here that is not already in the spec
- [ ] Every task's `goal` is one observable sentence, and no task is a layer
- [ ] `deps` expresses every real ordering constraint; nothing depends on list order
- [ ] `files` is filled in for every task, wide rather than narrow, and disjoint where tasks run at once
- [ ] Every signature crossing a task boundary is on the consuming task's `interfaces`
- [ ] `model` is a tier word or `null` — never a model id
- [ ] The breakdown and the mode question went past the user in one message; `status` is `ready` and `mode` is set

## Red Flags

| Thought | Reality |
|---|---|
| "I will put the acceptance criteria in the plan, close to the tasks" | Then they exist twice, and the plan is the gitignored copy that goes stale. Verification reads the spec. |
| "The spec is a bit vague here, I will settle it in the plan" | That is a requirement decided by whoever is writing the route, without the user. |
| "Task 1: write the tests. Task 2: make them pass" | One round of TDD split across two contexts. One task. |
| "This came out differently, I will update the plan to match" | Then the next session cannot tell a decision from a drift. |

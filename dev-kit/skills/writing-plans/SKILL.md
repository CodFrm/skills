---
name: writing-plans
description: >-
  Use once a spec is approved and the change breaks into more than about three steps, or will span more than one session. Use it again when work already under way turns out to decompose differently than planned. Not for: settling what to build — that is a spec, and it comes first; a change small enough to finish in one session; or a plan that already exists and only needs running.
---

# Writing a plan

**The spec settles what to build. The plan settles how — and nothing else.**

That line is the whole design. A requirement written into a plan is a requirement in two documents with nothing keeping them equal, and the plan is the copy nobody commits. So the plan carries **route, order and state**: which slices, in what order, what is currently running. When someone asks "what must this do", the answer is the spec, every time.

**A plan is a working file, not a document.** It is `.dev-kit/plans/*.yaml`, gitignored, and it exists to be read by whoever runs the next task — possibly in another session, possibly a subagent with no memory of this conversation. Write it for them.

## One slug for everything

The plan takes **the spec's own slug**:

```
docs/specs/2026-07-30-oauth-login.md      the spec
.dev-kit/plans/2026-07-30-oauth-login.yaml  the plan
.dev-kit/artifacts/2026-07-30-oauth-login/  mockups, evidence, the report
oauth-login / feat/oauth-login              worktree directory / branch
```

**Never invent a second name.** One slug means the branch, the plan and the evidence can always be found from each other, and it removes the only thing the old two-name arrangement ever produced: two things to keep in step, and nothing declaring either.

## Check the ground first

**Every fact in the plan is something you verified, with a `file:line` behind it.** A plan built on what you assume the code does is a plan whose task list stops matching reality at task two — and the person who finds out is a subagent with no way to check.

Read before you write: the spec in full, the modules it touches, the existing tests for them, and how this project already does the thing you are about to do again. Where the surface is wide, dispatch that reading — one module each, reporting back "conclusion + `file:line`".

## The file

```yaml
spec: docs/specs/2026-07-30-oauth-login.md   # required — a change this size owes a spec
status: draft            # draft → ready → running → done | stopped
mode: null               # subagent | inline — executing-plans writes this, not you
worktree: null           # path, or "none: <reason>" — executing-plans writes this

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
    status: todo                # todo → doing → done | blocked
    note: null                  # only when blocked, or when done came out different

  - id: 2
    goal: ...
    deps: [1]
    files: [src/auth/session.ts, tests/auth/session.test.ts]
    interfaces: "consumes refreshSession(token: string): Session from task 1"
    status: todo

review:                  # wrap-up state, so a resumed session knows where it stands
  round: 0               # fix rounds spent; three is the ceiling
  status: pending        # pending → passed | stopped
```

**`files` is load-bearing, not documentation.** It is what lets two ready tasks be dispatched at the same time: overlapping paths means they run one after the other instead. Guess it wide rather than narrow — a task that turns out to touch more than it declared is the one that corrupts a sibling's work.

**`interfaces` is where a signature crosses a task boundary.** When task 2 calls something task 1 builds, that name and its type go on task 2's line — **not into the dispatch prompt**. A fact typed only into a prompt has to be retyped into the next one, and the one after that; it is the class of fact a compaction destroys while the plan survives. Leave it `null` where nothing crosses.

## Cutting the tasks

**A task is a vertical slice: one complete capability, one fresh context window, one whole RED→GREEN→REFACTOR round.**

- **Never cut by layer.** "Write the tests" is not a task, and neither is "add the types" — both leave something nobody can observe and a round of TDD split across two contexts.
- **One sentence of observable outcome each.** Two sentences that will not reduce to one are two tasks. Not being able to write the sentence means the slice is not understood yet, and no amount of detail elsewhere fixes that.
- **Size it to one context window.** A task a subagent cannot finish without exploring the whole repository was cut too big.
- **`deps` is the only ordering.** Do not rely on the list's order — the executor picks by `deps`, so a task that truly must follow another has to say so.

**Aim for parallelism where the work genuinely splits, and do not manufacture it.** Three tasks in disjoint directories are worth cutting apart; three tasks that all edit one file are one task wearing three hats.

## Choosing a model: a tier, never an id

**`model` names one of three relative tiers — `cheap`, `mid`, `strong` — and the executor resolves it against whatever the harness actually offers at dispatch time.**

**Never write a model id into the plan.** One repository gets worked on from several harnesses, so an id pinned here is authoritative on none of them and wrong on most; name a model the harness does not have and the dispatch either fails outright or silently falls back to something nobody chose.

Read the tier off the task's own text — how much of the *how* is already written down, and how much is left for the implementer to work out:

| What the task looks like | Tier |
|---|---|
| The task already says how: names the file, the command, the pattern to copy | `cheap` |
| Cross-file coordination, following an existing pattern, or investigating a fault | `mid` |
| Design judgement, or a large stretch of code to read before a line can be written | `strong` |

**Pick per task, not once for the round** — a plan's tasks are not one size, and one tier for all of them is wrong in both directions at once: it either pays the hard task's price ten times over or sends the hard task out underpowered, and the second is the expensive mistake.

**Rounds cost more than unit price.** The cheapest tier often burns two or three attempts on a task the middle tier would finish in one, which costs more overall. So the floor for `cheap` is narrow: it only has to follow the task text and run the tests. **Anything requiring the implementer to work something out for itself starts at `mid`.** Leaving it `null` is fine and inherits the session's model — usually the most expensive tier there is, which is why it is worth a moment's thought on the tasks that clearly do not need it.

## The gate, then freeze

**A `draft` plan is not something to work from.** Put the task breakdown to the user — the slices, the order, what runs in parallel — and let them veto. They are ruling on how the work is cut, not re-approving what it does; that was the spec's gate and it is already settled. Set `status: ready` only after that.

**Once it is `ready`, what is frozen is the shape of the work — not the file.** Two kinds of field go on being written during execution, and the line between them is worth holding:

| Written during execution | Frozen until the user re-cuts it |
|---|---|
| **State** — `status` (plan and task), `note`, `mode`, `worktree`, `review` | `goal`, and each task's `goal`, `deps`, `files`, `model` |
| **Facts discovered** — appended to `context`, and to a task's `interfaces` | |

**Facts accrete; the shape of the work does not.** A task coming back `missing context` has usually found something true about the code that nobody had written down — that goes into `context` so the next dispatch has it, and doing so is not editing the plan, it is finishing it. **A fact that contradicts an entry already there is a different thing**: that is a collision, and it goes to the user.

**When the plan turns out to be wrong, say so and change it deliberately.** A slice that will not decompose the way you cut it, a dependency nobody saw, a task the spec does not actually require — those are real, and the answer is to stop, state what changed, and re-cut the affected tasks with the user. What is not allowed is editing the plan quietly so that it agrees with what already happened; a plan rewritten to match the code records nothing, and the next session cannot tell a decision from a drift.

**The spec is frozen harder.** If the work shows the requirement itself was wrong, that goes back through [`brainstorming`](../brainstorming/SKILL.md) and the user — not into the plan, and not into the code.

## Checklist

- [ ] `spec:` points at an approved, committed spec, and the plan's slug is that spec's slug
- [ ] Every entry in `context` was verified just now and carries a `file:line` or a command
- [ ] No requirement is stated here that is not already in the spec — the plan says how, not what
- [ ] Every task's `goal` is one observable sentence, and no task is a layer
- [ ] `deps` expresses every real ordering constraint; nothing depends on list order
- [ ] `files` is filled in for every task, wide rather than narrow
- [ ] Tasks that can genuinely run at once have disjoint `files`
- [ ] Every signature crossing a task boundary is on the consuming task's `interfaces`, not left for a prompt
- [ ] `model` is a tier word or `null` — never a model id
- [ ] The breakdown went past the user and `status` is `ready`

## Red Flags

| Thought | Reality |
|---|---|
| "I will put the acceptance criteria in the plan so they are close to the tasks" | Then they exist in the spec and here, and the plan is the copy that is gitignored and goes stale. Verification reads the spec. |
| "The spec is a bit vague here, I will settle it in the plan" | That is a requirement being decided by whoever is writing the route, without the user. It goes back to the spec and its gate. |
| "Task 1: write the tests. Task 2: make them pass" | That is one round of TDD split across two contexts, and GREEN needs the failure output RED produced. One task. |
| "I know roughly how this module works, that is enough to plan it" | Roughly is where the task list stops matching the code, and the person who discovers it is a subagent with no way to check. Open the file, take the `file:line`. |
| "`files` is bookkeeping, I will fill it in later" | It is what decides whether two tasks may run at the same time. Blank means everything serialises, or worse, two agents write one file. |
| "I will put the exact model id in, to be unambiguous" | Unambiguous on this harness and wrong on the next one, where it fails or silently falls back. Name the tier; the executor resolves it. |
| "Task 2 needs task 1's signature — I will put it in the dispatch prompt" | Then it has to be retyped for every later task, and a compaction destroys it while the plan survives. It goes on task 2's `interfaces`. |
| "The plan and the branch can have different names, it is only a name" | Two names is two things to keep in step and nothing declares either. One slug, from the spec. |
| "This came out differently, I will update the plan to match" | Then the plan records nothing and the next session cannot tell a decision from a drift. Say what changed, then change it on purpose. |

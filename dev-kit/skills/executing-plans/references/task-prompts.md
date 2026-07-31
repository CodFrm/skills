# Task-loop prompts

The dispatches one batch takes: one implementer per task, then one review over their commits that fixes what it finds. **[The rules every dispatch shares](prompts.md#what-every-dispatch-shares) hold for both** — read them first, and fill every `<>` slot.

## Implementer

One per task, at the tier its plan line names. In `inline` mode, follow the same structure yourself.

```
Your job is task <id> in the plan at <plan file path>.

Read the plan's goal, context and your own task line <id> — in full. Do not open the other
task lines.

The approved spec is at <spec path>. Open it for exactly two things, not end to end:
- its testing decisions — those seams were confirmed with the user, so use them rather
  than choosing a boundary of your own;
- the requirement your task's goal serves, in the spec's own words.
Where the spec asks for more than your task line does, that is a note in your report, not
work you take on.

<one sentence: where this task sits in the whole thing, and anything an earlier task left
that the plan cannot yet say. A signature belongs in your task line's `interfaces` field,
not here>

Follow <test-driven-development | systematic-debugging>. **TDD is not optional**: the
failing test comes first, you run it, and you confirm it fails for the missing behaviour
rather than a typo or a bad import. Then the minimum code that passes. Then refactor.

Boundaries:
- Do this one task only. Report other problems you find; do not fix them in passing.
- Work in <files>. Everything outside that list belongs to another task, possibly running
  right now.
- Run only the tests covering your own files. The full suite is mine.
- Commit when you are done — one commit, this task only, message following the project's
  existing convention, no task id in it.
- **Stage and commit by path**: `git add <the paths you changed>`, then commit those same
  paths. Never `git add -A` or `git add .` — another task may be running in this same
  worktree. If git refuses with `index.lock`, nothing was written: wait and retry.
- Do not touch the plan file, and do not set your own status.

Ask rather than guess — stopping is allowed and costs you nothing:
- Ambiguity in the task or the plan — a goal that reads two ways, two valid approaches with
  nothing choosing between them, an assumption nobody stated — comes back as
  `missing context` **before you write code**.
- Say `stuck` when the task needs a design decision with several defensible answers, when
  you have read file after file without the picture coming together, or when you are not
  convinced your own approach is right.
- Either way the specifics come back with it: what you are stuck on, what you tried, what
  would unblock you. "Stuck" alone hands me a guessing game instead of a decision.

Before reporting, read your own diff with fresh eyes — a reviewer reads this commit next:
- Completeness: every part of your goal, one by one, plus the edge cases it implies.
- Discipline: anything in the diff nothing asked for? An abstraction with one caller, an
  option nobody sets? Take it back out.
- Patterns: does this read like the code around it, or like your own dialect?
- Tests: do they verify real behaviour rather than the mock's? Would they fail if the
  implementation were wrong?
Fix what this finds now, and say in one line that you did.

Report back in at most 15 lines. No report file, and do not replay how you got there:
- status (below), and the commit's short SHA
- the commands you ran, each with its exit code — including the RED run and what it failed on
- what you actually observed, not what you expected
- your goal confirmed point by point, or which part of it is not yet true
- concerns, and anything that contradicts the plan's context

Everything you read, every path you tried and abandoned, stays with you.

Status is one of four: complete / complete with concerns / stuck / missing context.
If you are unsure which, say so.
```

## Batch review and fix

One per batch in `subagent` mode, dispatched once no task in it is left `doing`, at the highest tier among its tasks with `mid` as the floor. **It reviews that batch's commits and fixes what it finds**, both in this dispatch — see [the batch review and its fix](../SKILL.md#the-batch-review-and-its-fix-the-second-gate-before-done). **`inline` mode does not use this template at all.**

```
Review one batch of commits and fix what you find — tasks <ids> of the plan at
<plan file path>.

These commits are the whole scope, one per task:

  <id> · <sha> · <task goal, verbatim> · files: <files>
  <id> · <sha> · <task goal, verbatim> · files: <files>

Read them with `git show <sha>`. Do not read the working tree, and do not review any commit
outside that list; every earlier batch was reviewed when it landed.

The spec is at <spec path>. Read two things in it and nothing else: the requirements these
tasks serve — <which ones> — and its testing decisions, which is the boundary the tests were
supposed to be written at.

Four questions, in this order:
(a) Each goal, one task at a time. Is that task's sentence observably true in its own
    commit, and does what the spec asked of it actually arrive? Name the test or the code
    path that makes it true. "Looks implemented" is not an answer.
(b) The project's conventions. Does this read like the project or like one agent's dialect?
    Read AGENTS.md / CLAUDE.md and docs/testing.md if they exist, and the files immediately
    around the changes. **Be specific about the convention and where it is established** —
    "src/auth/session.ts:20 does X, this does Y" — because a preference of your own
    presented as a convention costs a fix that changes nothing.
(c) The batch against itself. These tasks were written at the same time by contexts that
    could not see each other. Two of them solving one concern two different ways, or a name
    and type one produces that another consumes without lining up, is a finding here and
    nowhere else — no later reviewer holds these commits together.
(d) The code. Incorrect logic, unhandled edge cases and error paths, resource and
    concurrency mistakes, security exposure, tests that assert nothing or only assert the
    mock, dead code, anything left in that should not ship.

This batch is one slice of a larger plan — where a reviewer here goes wrong most:
- It may only touch the files listed above. Something missing outside them is another
  task's job.
- An exported name with no caller yet is usually a later task's — raise it as a question,
  not as dead code.
- Do not ask for the abstraction the whole feature might eventually want.

On every finding: severity — blocking / significant / minor — the task id it lands on,
file:line, and the input or state that makes it break. **A finding you cannot make fail is a
suspicion; say so.** Where a goal or the spec is ambiguous enough that you cannot tell, that
is a finding of its own kind, addressed to me rather than to the code.

Then fix what you found. Write the findings down first and fix from that list — a fix begun
mid-read shapes the findings to it.

- Each finding is its own TDD round: the failing test first, watched failing for the finding
  rather than a typo, then the smallest fix. Nothing beyond the findings.
- Work only in the files listed above, and run only the tests covering them. The full suite
  is mine.
- One commit for the lot, on top of the last commit in the list, message per the project's
  convention. **Stage and commit by path** — never `git add -A`.
- Two you hand back instead of fixing: a finding whose fix is a design decision rather than
  a correction, and anything that says the plan itself is wrong.
- Do not touch the plan file, and do not set any task's status.

Report in at most 15 lines plus 3 per task, no report file: every finding, most severe
first, with the task id, the test that now covers it or the reason it is still open; the new
commit's short SHA; the commands with their exit codes. Nothing found is one line saying so.
Do not summarise the commits back to me, do not narrate how you read them, and do not list
what you checked and found fine.

Status: complete / complete with concerns / stuck / missing context.
```

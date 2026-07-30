# Dispatch prompts

Four templates. Fill the `<>` slots from the plan and the spec — **do not send a slot through unfilled**, a subagent cannot ask you what it meant.

## What every dispatch shares

**A prompt describes one task, not the history of the session.** Point at paths for earlier output; do not paste contents. Every word pasted in stays in your context until the session ends and is re-read on every later turn — which is the cost dispatching exists to avoid.

**What comes back is the conclusion, not the working transcript.** Left unsaid, a subagent returns everything it read and ran; you pay for all of it, and the isolation you dispatched for is gone. So every prompt below bounds what comes back — and bounds it **by form, not by truncation**: an implementer's evidence is a few commands with their exit codes, a reviewer's is one line per finding. Neither is long. What must not come back is the exploring that produced it.

**No report files.** The orchestrator judges an implementer's evidence the moment it arrives and records the outcome in the plan; the reviewers' findings go straight into the fix round. Nothing reads any of it afterwards, so a file written for each would be write-only — and re-running the reviews regenerates them anyway. **The one durable artifact of the round is the verification report at the end.**

**A subagent reports evidence and never rules its own work complete.** That judgement is yours. A prompt missing the line gets back "done ✅" instead of the command that proves it.

**Resolve the model tier per dispatch.** The plan names `cheap` / `mid` / `strong`; you map those onto what this harness actually offers, fresh each time. **Never invent a model id** — one the harness lacks either fails the dispatch or falls back to something nobody chose. If you cannot tell what is available, say so in one line and dispatch on the default.

## Implementer

One per task, at the tier its plan line names. In `inline` mode, follow the same structure yourself.

```
Your job is task <id> in the plan at <plan file path>.

Read the plan's goal, context and your own task line <id> — in full. The other task lines
are not your business: do not open them. That, plus this prompt, is what scopes the task.

The approved spec is at <spec path>. The plan says what to build; the spec is what was
promised. Open it for exactly two things, not end to end:
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
- Run only the tests covering your own files. The full suite is mine, not yours.
- Commit when you are done — one commit, this task only, message following the project's
  existing convention, no task id in it.
- **Stage and commit by path**: `git add <the paths you changed>`, then commit those same
  paths. Never `git add -A` or `git add .` — another task may be running in this same
  worktree, and its half-written files are one `-A` away from landing in your commit. If
  git refuses with `index.lock`, nothing was written: wait a moment and retry.
- Do not touch the plan file, and do not set your own status.

Ask rather than guess — stopping is allowed and costs you nothing:
- Ambiguity in the task or the plan — a goal that reads two ways, two valid approaches with
  nothing choosing between them, an assumption nobody stated — comes back as
  `missing context` **before you write code**. One turn spent asking is cheaper than
  unpicking a guess three tasks later.
- Say `stuck` when the task needs a design decision with several defensible answers, when
  you have read file after file without the picture coming together, or when you are not
  convinced your own approach is right.
- Either way the specifics come back with it: what you are stuck on, what you already tried,
  what would unblock you. "Stuck" alone hands me a guessing game instead of a decision.

Before reporting, read your own diff with fresh eyes. A reviewer reads this commit next and
fixes what it finds in your place, so anything you leave here gets rewritten by someone whose
judgement you never see:
- Completeness: every part of your goal, one by one, plus the edge cases it implies without
  listing them.
- Discipline: anything in the diff nothing asked for? An abstraction with one caller, an
  option nobody sets? Take it back out.
- Patterns: does this read like the code around it, or like your own dialect dropped in?
- Tests: do they verify real behaviour rather than the mock's? Would they fail if the
  implementation were wrong?
Fix what this finds in your own diff now, and say in one line that you did.

Report back in at most 15 lines. Do not write a report file, and do not replay how you got
there — I need only what lets me judge it:
- status (below), and the commit's short SHA
- the commands you ran, each with its exit code — including the RED run and what it failed on
- what you actually observed, not what you expected
- your goal confirmed point by point, or which part of it is not yet true
- concerns, and anything that contradicts the plan's context

Everything you read, every file you opened, every path you tried and abandoned stays with you.
Sending it costs me context and tells me nothing I act on.

Status is one of four: complete / complete with concerns / stuck / missing context.
If you are unsure which, say so — something forced out costs more than something not produced.
```

## Task review and fix

One per task in `subagent` mode, dispatched the moment that task's evidence passes, at the task's own tier with `mid` as the floor. **It reviews one commit and fixes what it finds**, both in this dispatch — see [the task review and its fix](../SKILL.md#the-task-review-and-its-fix-the-second-gate-before-done). **`inline` mode does not use this template at all**: there is no per-task review on that path, and wrap-up is the first outside reading.

```
Review one commit and fix what you find: git show <sha> — task <id> of the plan at
<plan file path>.

That commit is the whole scope. Do not read the working tree — other tasks may be running
in it right now and their half-written files are not your business. Do not review earlier
commits on this branch; each was reviewed when it landed.

What the task promised, in its own words: <task goal, verbatim>

The spec is at <spec path>. Read two things in it and nothing else: the requirement this
task serves — <which one> — and its testing decisions, which is the boundary the tests were
supposed to be written at.

Three questions, in this order:
(a) The goal. Is that sentence observably true in this commit, and does what the spec asked
    of it actually arrive? Name the test or the code path that makes it true. "Looks
    implemented" is not an answer to this question.
(b) The project's conventions. Does this read like the project or like one agent's dialect?
    Read AGENTS.md / CLAUDE.md if there is one, docs/testing.md if there is one, and the
    files immediately around the change. Naming, error handling, layering, how tests are
    structured, what gets logged. **Be specific about the convention and where it is
    established** — "src/auth/session.ts:20 does X, this does Y" — because a preference of
    your own presented as a convention costs a fix that changes nothing.
(c) The code. Incorrect logic, unhandled edge cases and error paths, resource and
    concurrency mistakes, security exposure, tests that assert nothing or only assert the
    mock, dead code, anything left in that should not ship.

The task was cut as one slice of a larger plan, and this is where a task reviewer goes wrong
most often:
- It may only touch <files>. Something missing that lives outside that list is another
  task's job, not a finding.
- An exported name with no caller yet is usually a later task's — raise it as a question,
  not as dead code.
- Do not ask for the abstraction the whole feature might eventually want. This commit is
  judged against its own goal.

On every finding: severity — blocking / significant / minor — file:line, and the input or
state that makes it break. **A finding you cannot make fail is a suspicion; say so.** Where
the goal or the spec is ambiguous enough that you cannot tell whether this is right, that is
a finding of its own kind, addressed to me rather than to the code.

Then fix what you found. Write the findings down first and fix from that list — a fix begun
mid-read shapes the findings to it, and I never learn what was quietly repaired.

- Each finding is its own TDD round: the failing test first, watched failing for the finding
  rather than a typo, then the smallest fix. Nothing beyond the findings.
- Work only in <files>, and run only the tests covering them. The suite is mine.
- One commit for the lot, on top of the commit you reviewed, message per the project's
  convention. **Stage and commit by path** — never `git add -A`, a sibling task may be
  writing into this worktree.
- Two you hand back instead of fixing: a finding whose fix is a design decision rather than a
  correction, and anything that says the plan itself is wrong. Both are mine.
- Do not touch the plan file, and do not set your own status.

Report in at most 15 lines, and do not write a report file: every finding, most severe first,
with the test that now covers it or the reason it is still open; the new commit's short SHA;
the commands with their exit codes. Nothing found is one line saying so. Do not summarise the
commit back to me, do not narrate how you read it, and do not list what you checked and found
fine.

Status: complete / complete with concerns / stuck / missing context.
```

## Spec verification

Wrap-up, dispatched at `strong` alongside the code review. Each task's commit was reviewed on its own as it landed; this and the code review are **the only reading the branch gets as a branch** — say nothing to either about the reviews that came before.

```
Verify this branch against its spec. Read the spec in full first: <spec path> — the
requirements are in its design prose, so there is no shortcut section to read instead.

Scope: git diff $(git merge-base <baseline branch> HEAD)..HEAD — <n> commits.

Three questions, and nothing else:
(a) Missing or half done — the spec asks for it and the diff does not deliver, or delivers
    one part and leaves the rest.
(b) Not asked for — behaviour in the diff no part of the spec calls for. Check the spec's
    non-goals too: crossing one belongs here, and is not a bonus.
(c) Done wrong — present and plausible-looking, but not what the spec describes.

Quote the spec's own sentence for every finding, then say what the diff does instead, with
file:line. A finding with no quote behind it is an opinion about the design, which is not
what this asks for.

You are not reviewing code quality — that is running separately, right now. Only: does this
do what was agreed?

Rules:
- Read only. Do not touch the working tree, the index, HEAD or any branch, and repair
  nothing — a reviewer that fixes as it goes has reviewed its own work.
- Do not re-run the test suite. One targeted test only where reading raises a specific
  suspicion.
- Where the spec is silent or ambiguous, say so plainly instead of deciding for it. That is
  a finding of its own kind, addressed to the human.

Severity on every finding: blocking / significant / minor.

Report the findings themselves, most severe first, one entry each: severity, file:line, the
spec sentence quoted, and what the diff does instead. Do not write a report file. Do not
summarise the diff back to me, do not narrate how you read it, and do not list what you
checked and found fine — the findings are the whole deliverable, and everything else is
context I pay for and never act on. Nothing found is one line saying so.
```

## Code review

Same range, same time, `strong`.

```
Review this branch as code. Do not read the spec — whether it was the right thing to build
is being checked separately, right now.

Scope: git diff $(git merge-base <baseline branch> HEAD)..HEAD — <n> commits.

Look for: incorrect logic, unhandled edge cases and error paths, resource and concurrency
mistakes, security exposure, tests that assert nothing or assert an implementation detail,
dead code, anything left in that should not ship.

Look especially at what no single task's author could have seen, since each was written in
its own context:
- duplicate implementations across tasks, inconsistent naming, interfaces that do not line
  up at both ends
- the same concern solved two different ways in two places
- what the branch adds up to taken as a whole

Do not pick at the historical size of files this branch did not touch.

For each finding: file:line, what breaks, and the concrete input or state that makes it
break. **A finding you cannot make fail is a suspicion — say so and rank it separately.**
Severity on every finding: blocking / significant / minor.

Rules:
- Read only. Do not touch the working tree, the index, HEAD or any branch, and fix nothing.
- Do not re-run the test suite. One targeted test only where reading raises a specific
  suspicion.
- Stay inside the range. Step outside only to judge a risk you can name, and say what you
  were worried about and what you checked.

The bar is "would you ship this" — there is no later stage to catch what gets waved through.

Report the findings themselves, most severe first, one entry each: severity, file:line, what
breaks, and the input or state that makes it break. Do not write a report file. Do not
summarise the diff back to me, do not narrate how you read it, and do not list what you
checked and found fine — the findings are the whole deliverable, and everything else is
context I pay for and never act on. Nothing found is one line saying so.
```

### Do not write the verdict into either review prompt

**Nothing you send tells a reviewer what it may not raise.** No "no need to look at X", no "X was deliberate", no "X is minor at most", no "we already decided this".

Bounding the **method** is legitimate and both templates do it — this range only, read-only, do not re-run the suite. Bounding the **conclusions** is a different thing wearing the same clothes. **If what you are about to add contains "no need to", "do not flag", "at most minor" or "already decided", stop**: you are sparing yourself a fix, not improving the review, and you are spending the one advantage the reviewer has over you — it was not there when the code was written.

The two go out **together and stay unmerged**. A change can follow every convention and implement the wrong thing, or do exactly what was asked and break every pattern; one reviewer holding both questions lets the louder answer stand in for the quieter one.

## Fixing findings

**Every fix is a TDD round with the finding's own failing test as RED** — a fix with no test is a fix nothing will catch the second time.

**A task's findings are fixed by the subagent that found them, inside [that same dispatch](#task-review-and-fix).** Nothing extra is sent: the template above already carries the fix instructions, and that context holds the commit, the conventions it opened and the case it made.

**Wrap-up's findings go to a fresh dispatch**, because by then the reviewer that would fix them is several tasks gone and the finding is often about two tasks at once. Reuse the implementer prompt with the finding in place of the task goal. Dispatch at `mid`, or `strong` where the finding needs design judgement rather than correction.

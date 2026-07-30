# Dispatch prompts

Three templates. Fill the `<>` slots from the plan and the spec — **do not send a slot through unfilled**, a subagent cannot ask you what it meant.

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

Before reporting, read your own diff with fresh eyes. Nobody else reads it until the whole
branch is reviewed at the end, so what you miss here travels a long way:
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

## Spec verification

Wrap-up, dispatched at `strong` alongside the code review. This and the code review are **the only reading this branch gets from anyone who did not write it.**

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

## Fix rounds

Reuse the implementer prompt, with the finding in place of the task goal and **the finding's own failing test as the RED step**. A fix with no test is a fix nothing will catch the second time. Dispatch at `mid`, or `strong` where the finding needs design judgement rather than correction.

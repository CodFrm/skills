# Dispatch prompts

Three templates. Fill the `<>` slots from the plan and the spec — **do not paste a slot through unfilled**, a subagent cannot ask you what it meant.

All three share one rule worth stating in each: **a subagent reports evidence and does not rule its own work complete.** That judgement is the orchestrator's, and a prompt that omits the line gets back "done ✅" instead of the command that proves it.

## Implementer

One per task. In `inline` mode, follow the same structure yourself.

```
Task <id> of <plan slug>: <task goal, verbatim from the plan>

Spec: <path>. This task serves: <the requirements it is making true — name them>.
Read the spec before you start; it is what this is measured against.

Work in: <files>. Everything outside that list is another task's, possibly
running right now — do not touch it.

**TDD is mandatory.** Write the failing test first, run it, and confirm it fails
for the missing behaviour rather than a typo or a bad import. Then the minimum
code that makes it pass. Then refactor. One happy path plus the edge or failure
case this contract genuinely owns. Test design follows docs/testing.md if the
project has one.

Run only the tests covering your own files — the full suite is the orchestrator's.
On a fault you cannot explain, do not guess at a fix: reproduce it, find the root
cause, then make the reproduction your failing test.

Report back:
- the commands you ran, each with its exit code
- what you actually observed — not what you expected
- file:line for every claim you make about the repository
- anything you found that contradicts the spec or the task

Do not declare the task complete. Report the evidence; it is judged elsewhere.
```

`model` where the task sets one, otherwise inherit.

## Spec verification

Dispatched at wrap-up, in parallel with the code review.

```
Verify this branch against its spec. Read the spec in full first: <path>.

The diff: git diff <merge-base>..HEAD — <n> commits.

For each requirement the spec states, decide: met / partly met / not met /
cannot be observed from the code. Quote the spec sentence, then point at the
code with file:line, then say which. Where it is partly met, say precisely
what is missing.

Then two sweeps in the other direction:
- behaviour in this diff that the spec does not ask for, and nobody agreed to
- requirements the spec states that nothing in this diff touches at all

You are not reviewing code quality — that is running separately. Only: does
this do what was agreed?

Report findings with a file:line each. Say plainly where the spec itself is
too vague to rule on; that is a finding, not a gap in your reading.
```

## Code review

```
Review this branch as code. Do not read the spec — whether it was the right
thing to build is being checked separately.

The diff: git diff <merge-base>..HEAD — <n> commits.

Look for: incorrect logic, unhandled edge cases and error paths, resource and
concurrency mistakes, security exposure, tests that assert nothing or assert an
implementation detail, dead code, and anything left in that should not ship.

For each finding: file:line, what breaks, and the concrete input or state that
makes it break. **A finding you cannot make fail is a suspicion — say so and
rank it separately.** Ranked most severe first.

Do not rewrite the code. Report.
```

## Fix rounds

Reuse the implementer prompt, with the finding in place of the task goal and **the finding's own failing test as the RED step**. A fix with no test is a fix nothing will catch the second time.

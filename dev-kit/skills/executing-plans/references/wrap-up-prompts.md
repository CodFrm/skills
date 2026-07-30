# Wrap-up prompts

The branch's only static reading as a branch: the two go out in parallel, at `strong`, read-only. **[The rules every dispatch shares](prompts.md#what-every-dispatch-shares) hold for both**, and so does **[do not write the verdict into either prompt](prompts.md#do-not-write-the-verdict-into-either-review-prompt)** — read that before adding a word of your own. Fill every `<>` slot.

## Static spec verification

Wrap-up, dispatched at `strong` alongside the code review. This is static verification against the spec and diff; a fresh subagent performs runtime verification only after this review loop passes. **Say nothing to either reviewer about the per-task reviews that came before.**

```
Statically verify this branch against its spec. Read the spec in full first: <spec path> — the
requirements are in its design prose, so there is no shortcut section to read instead.

Scope: git diff $(git merge-base <baseline branch> HEAD)..HEAD — <n> commits.

Three questions, and nothing else:
(a) Missing or half done — the spec asks for it and the diff does not deliver, or delivers
    one part and leaves the rest.
(b) Not asked for — behaviour in the diff no part of the spec calls for. Check the spec's
    non-goals too: crossing one belongs here, and is not a bonus.
(c) Done wrong — present and plausible-looking, but not what the spec describes.

Quote the spec's own sentence for every finding, then say what the diff does instead, with
file:line. A finding with no quote behind it is an opinion about the design.

You are not reviewing code quality — that is running separately, right now. Only: does this
diff implement what was agreed? Do not claim runtime behaviour was observed; a fresh runtime
verifier runs after both static reviews pass.

Rules:
- Read only. Do not touch the working tree, the index, HEAD or any branch, and repair
  nothing — a reviewer that fixes as it goes has reviewed its own work.
- Do not re-run the test suite. One targeted test only where reading raises a specific
  suspicion.
- Where the spec is silent or ambiguous, say so plainly instead of deciding for it. That is
  a finding of its own kind, addressed to the human.

Severity on every finding: blocking / significant / minor.

Report the findings themselves, most severe first, one entry each: severity, file:line, the
spec sentence quoted, and what the diff does instead. No report file. Do not summarise the
diff back to me, do not narrate how you read it, and do not list what you checked and found
fine. Nothing found is one line saying so.
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
- Do not re-run the test suite. One targeted test only where reading raises a suspicion.
- Stay inside the range. Step outside only to judge a risk you can name, and say what you
  were worried about and what you checked.

The bar is "would you ship this" — there is no later code review to catch what gets waved through.

Report the findings themselves, most severe first, one entry each: severity, file:line, what
breaks, and the input or state that makes it break. No report file. Do not summarise the
diff back to me, do not narrate how you read it, and do not list what you checked and found
fine. Nothing found is one line saying so.
```

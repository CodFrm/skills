# Dispatch prompts

Five templates, in three files by the stage that sends them:

| Stage | Templates |
|---|---|
| **The task loop** — [task-prompts.md](task-prompts.md) | [implementer](task-prompts.md#implementer), [batch review and fix](task-prompts.md#batch-review-and-fix) |
| **Static wrap-up** — [wrap-up-prompts.md](wrap-up-prompts.md) | [static spec verification](wrap-up-prompts.md#static-spec-verification), [code review](wrap-up-prompts.md#code-review) |
| **Runtime verification** — [verification-prompt.md](verification-prompt.md) | [runtime verifier](verification-prompt.md#runtime-verification-prompt) |

**This page is what holds for all five; open only the stage you are about to dispatch.** Fill the `<>` slots from the plan and the spec — **never send a slot through unfilled**, a subagent cannot ask you what it meant.

## What every dispatch shares

**A prompt describes one task, not the history of the session.** Point at paths for earlier output; do not paste contents — every word pasted in stays in your context until the session ends.

**What comes back is the conclusion, not the working transcript.** Left unsaid, a subagent returns everything it read and ran, and the isolation you dispatched for is gone. Every template bounds the return **by form**: an implementer's evidence is a few commands with their exit codes, a reviewer's is one line per finding, and the runtime verifier returns the report path, verdicts and evidence index.

**Implementers and reviewers create no report files.** An implementer's return is recorded in the plan and its commit goes to the batch review; the reviewers' findings go into wrap-up's bounded fixer flow. The runtime verifier alone writes the round's durable report under `e2e/scratch/<spec-slug>/`.

**A subagent reports evidence and never rules its own work complete.** A prompt missing that line gets back "done ✅" instead of the command that proves it.

**Resolve the model tier per dispatch** — the plan names `cheap` / `mid` / `strong`, and you map those onto what this harness offers. **Never invent a model id**: one the harness lacks either fails the dispatch or falls back to something nobody chose.

## Do not write the verdict into either review prompt

**Nothing you send tells a reviewer what it may not raise.** No "no need to look at X", no "X was deliberate", no "X is minor at most", no "we already decided this".

Bounding the **method** is legitimate and both wrap-up templates do it — this range only, read-only, do not re-run the suite. Bounding the **conclusion** is a different thing wearing the same clothes. **If what you are about to add contains "no need to", "do not flag", "at most minor" or "already decided", stop**: you are spending the reviewer's one advantage over you — it was not there when the code was written.

**The two go out together and stay unmerged.** A change can follow every convention and implement the wrong thing, or do exactly what was asked and break every pattern; one reviewer holding both questions lets the louder answer stand in for the quieter one.

## Fixing findings

**Every fix is a TDD round with the finding's own failing test as RED.**

**A batch's findings are fixed by the subagent that found them, inside [that same dispatch](task-prompts.md#batch-review-and-fix)** — nothing extra is sent.

**Wrap-up's findings go to a fresh dispatch**, because by then the reviewer that would fix them is several batches gone and the finding is often about two batches at once. Reuse [the implementer prompt](task-prompts.md#implementer) with the finding in place of the task goal, at `mid` — or `strong` where the finding needs design judgement rather than correction.

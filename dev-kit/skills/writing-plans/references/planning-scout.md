# Planning scout

Read [shared dispatch rules](../../executing-plans/references/prompts.md#what-every-dispatch-shares) and fill every slot.

```text
Explore <workspace> and propose how to cut <spec path> into implementation tasks.
This is a read-only dispatch: do not write, create or modify any file.

Read the whole spec first, then the modules it touches, their existing tests, and the project's
precedent for this kind of change.

Return three parts:

1. Context facts — each carrying `file:line` or the command that produced it. Facts only; do not
   repeat a requirement the spec already states.
2. Shared-write inventory — every generated artifact, lockfile, manifest, fixture, snapshot,
   registry, translation, configuration file and formatter-owned output this project writes, whether
   or not a proposed task names it. Give the command or config `file:line` that proves each one.
3. Proposed tasks — for each: `goal` (one observable vertical slice a failing test can show before
   the change), `deps` (ordering only), `files` (expected writes, already widened by the inventory
   above), `interfaces` (the cross-task name/signature it consumes).

Cut the smallest slice that carries a complete RED → GREEN → REFACTOR round on its own. Fold setup,
configuration, scaffolding and documentation into the task whose deliverable needs them, and merge
work that shares an outcome or test setup. Never exceed one implementer's context. Never split
tests, types or layers into separate tasks, and never make a task per file, function or mechanical
step.

Leave these to the orchestrator: do not decide which tasks run concurrently, do not add a `deps`
edge for any reason other than a consumed interface, and do not assign model tiers.

Return at most 60 lines and no report file. Rather than guessing when the spec contradicts the code
you read, return `stuck` with the exact unresolved clause.
```

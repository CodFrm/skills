# Task-loop prompts

Read [shared dispatch rules](prompts.md#what-every-dispatch-shares) and fill every slot.

## Implementer

```text
Implement task <id> from <plan path>.

Read the plan goal, context and task <id>. Do not read other task entries. Read from <spec path>
only the testing decisions and this task's served requirement: <requirement text>.

Context: <one sentence locating this slice; cross-task signatures belong in the plan's interfaces field>.

Use <test-driven-development | systematic-debugging then test-driven-development>. Show RED failing
for the missing behaviour, make the minimum GREEN change, then refactor while green.

Boundaries:
- Do only this task. Report unrelated problems; do not fix them.
- Owned paths: <files>. Do not write outside them.
- Dispatch: <serial, or parallel_evidence entry/index and exact HEAD>.
- Exclusive writes: <paths, or not applicable: serial>.
- Shared mutable resources not to touch: <list, or not applicable: serial>.
- Run focused tests only; the orchestrator runs the full suite.
- Commit this task once, by explicit path, using the project's message convention. Never use
  `git add -A` or `git add .`; on index.lock wait and retry.
- Do not edit the plan or set status.

Return before coding as `missing context` for ambiguity/unstated assumptions, or `stuck` for a
design decision, oversized exploration or an approach you cannot justify. State what blocks you,
what you tried and what would unblock you.

Before commit, inspect your diff for goal coverage, unrequested scope, project conventions and tests
that would fail under a wrong implementation; fix those issues.

Return at most 15 lines, no report file:
- status: complete | complete with concerns | stuck | missing context
- short commit SHA
- RED and GREEN commands with exit codes and deciding observations
- each goal clause confirmed, or the exact clause still false
- concerns and any contradiction with plan context
```

## Batch review and fix

Use once per completed batch in `subagent` mode. `inline` never uses this template.

```text
Review and fix tasks <ids> from <plan path>.

Scope, one commit per task:
<id> · <sha> · <goal verbatim> · files: <files>

Read only those commits with `git show <sha>`, not the working tree or other commits.
Implementer concerns, unjudged: <id · concern or none>.
From <spec path>, read only the served requirements <list> and testing decisions.

Review four axes:
1. Goal/spec: is each task's observable sentence delivered in its commit, with a real test/code path?
2. Project conventions: cite the governing instruction or adjacent precedent.
3. Batch consistency: duplicate solutions, names/types/interfaces that do not align.
4. Code: correctness, edge/error paths, resources/concurrency, security, dead code and test value.

Stay inside the listed files. Do not demand future-task callers or speculative abstractions.
For each finding give severity (blocking/significant/minor), task id, file:line, and concrete failing
input/state. Label unproven concerns as suspicions.

Write the findings first, then fix ordinary findings. Each fix is a TDD round. Commit all fixes once
by explicit paths; never `git add -A`. Run focused tests only.

Return without fixing:
- a wholly unimplemented task goal;
- a fix requiring a design decision;
- evidence that the plan is wrong.
Fix incomplete edge/error/test coverage when the goal otherwise arrived.

Do not edit the plan or task state.

Return at most 15 lines, no report file:
- status: complete | complete with concerns | stuck | missing context
- each finding and fixed/unresolved state
- fix commit SHA, if any
- commands and exit codes
- `nothing found` as one line when applicable
```

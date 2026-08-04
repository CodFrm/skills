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
- the RED command, its exit code and the failure it showed
- per goal part: one command, its exit code and the deciding observation, or the exact clause still false
- concerns and any contradiction with plan context
```

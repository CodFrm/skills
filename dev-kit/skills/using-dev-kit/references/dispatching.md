# What to dispatch to a subagent

The main session keeps the user conversation, decisions, plan writes and orchestration. Dispatch work only when:

- its input and boundaries fit in a prompt or referenced files;
- its result has a fixed, independently checkable shape;
- its working context is large but its conclusion is small.

Never dispatch user interaction, agreement gates or a RED→GREEN loop split across contexts. Code-level review must be independent in `subagent` mode; [`executing-plans`](../../executing-plans/SKILL.md#executing-a-plan) owns how reports become state transitions.

## Concurrency is opt-in

Dispatch serially by default. Every concurrent group, including read-only work, must pass [`executing-plans`' exact-HEAD four-boundary gate](../../executing-plans/SKILL.md#parallel-is-proved-not-assumed).

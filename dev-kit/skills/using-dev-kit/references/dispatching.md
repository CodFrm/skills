# What to dispatch to a subagent

The main session owns user conversation, decisions, plan writes and orchestration. Dispatch only when:

- its input and boundaries fit in a prompt or referenced files;
- its result has a fixed, independently checkable shape;
- its working context is large but its conclusion is small.

Never dispatch user interaction or agreement gates, or split RED→GREEN across contexts. In `subagent` mode code review stays independent; [`executing-plans`](../../executing-plans/SKILL.md#executing-a-plan) owns report-to-state transitions.

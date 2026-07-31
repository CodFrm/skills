# What to dispatch to a subagent

The main session is the **orchestrator**: it holds the goal, the constraints, the decisions and the conversation with the user. Work that would flush those out gets dispatched.

## Three properties, all required

| Property | What it means | Without it |
|---|---|---|
| **The input can be written down** | The context it needs fits in a prompt, or points at a file | You have not thought it through — go think first |
| **The output can be verified** | A command plus an exit code, a file you can open, a conclusion you can re-check | You are letting it happen, not judging it |
| **Loud middle, small conclusion** | Hundreds of lines of intermediate output, a conclusion of a few lines | The noise eats the main session's context |

## Three kinds not to dispatch

- **Anything needing back-and-forth with the user** — a subagent cannot ask them.
- **Tightly coupled short loops** — `test-driven-development`'s RED→GREEN is the case to know: the whole round travels together or not at all.
- **Parallel work hitting the same resource** — two agents writing one file, two runs fighting over one port. Parallelism is for **read-only** work or disjoint outputs.

## What must be dispatched

**The two static wrap-up reviews and the fresh runtime verifier** — not for context but for isolation. A round running `inline` runs them in that session instead; either way the reviews must pass before runtime verification starts.

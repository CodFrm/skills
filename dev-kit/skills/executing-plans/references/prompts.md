# Dispatch prompts

| Stage | Template |
|---|---|
| Task loop | [implementer and batch reviewer/fixer](task-prompts.md) |
| Static wrap-up | [spec verifier and code reviewer](wrap-up-prompts.md) |
| Runtime | [fresh verifier](verification-prompt.md) |

## What every dispatch shares

- Fill every `<>` slot from the plan/spec. Point to files instead of pasting session history.
- Resolve `cheap` / `mid` / `strong` against models available now; never invent a model id.
- Bound the return to findings/evidence/status, not a working transcript.
- Implementers/reviewers create no report file. Only the runtime verifier writes the durable local report.
- A subagent reports; it never sets plan state or declares the round done.

## Do not write the verdict into either review prompt

Keep spec verification and code review separate. Constrain scope and method, never conclusions: remove phrases such as “no need to inspect,” “do not flag,” “at most minor,” or “already decided.” Concurrency is independently gated by [`executing-plans`](../SKILL.md#parallel-is-proved-not-assumed).

## Fixing findings

Each fix starts with a failing test. A batch reviewer fixes its own ordinary findings in that dispatch. Wrap-up findings go to a fresh fixer using the implementer template with the finding as goal.

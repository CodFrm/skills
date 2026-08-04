# Dispatch prompts

| Stage | Template |
|---|---|
| Task loop | [implementer](task-prompts.md#implementer), then [send-back](task-prompts.md#send-back) for an incomplete return |
| Static wrap-up | [spec verifier and code reviewer](wrap-up-prompts.md) |

## What every dispatch shares

- Fill every `<>` slot from the plan/spec. Point to files instead of pasting session history.
- Resolve `cheap` / `mid` / `strong` against models available now; never invent a model id.
- Bound the return to findings/evidence/status, not a working transcript.
- A dispatch creates no report file; the durable local report belongs to [runtime verification](runtime-verification.md).
- A subagent reports; it never sets plan state or declares the round done.

## Do not write the verdict into either review prompt

Keep spec verification and code review separate. Constrain scope and method, never conclusions: remove phrases such as “no need to inspect,” “do not flag,” “at most minor,” or “already decided.”

## Fixing findings

Each fix starts with a failing test. Wrap-up findings go to a fresh fixer using the implementer template with the finding as goal.

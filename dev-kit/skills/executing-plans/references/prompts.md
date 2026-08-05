# Dispatch prompts

| Stage | Template |
|---|---|
| Task loop | [implementer](task-prompts.md#implementer), then [send-back](task-prompts.md#send-back) for an incomplete return |
| Wrap-up | [spec verifier and code reviewer](wrap-up-prompts.md) |

## What every dispatch shares

- Fill every `<>` slot from the plan/spec. Point to files instead of pasting session history.
- Resolve `cheap` / `mid` / `strong` against models available now; never invent a model id.
- Bound the return to findings/evidence/status, not a working transcript.
- A subagent reports; it never sets plan state or declares the round done.

## Writable wrap-up axis

Every axis prompt receives: `<workspace>`, `<range>`, `<pre-head>`, `<receipt>`, `<full-suite>`,
`<commit convention>` and `<write boundary>`. Start in that workspace; require a clean tree and exact
HEAD. Initialize the ignored receipt as `running` before review, then finish it atomically with axis,
pre/final HEAD, status, optional commit, and each deciding command/exit code/observation. An interrupted
invocation resumes that receipt and existing axis work; it does not restart review from the base.

Fix all owned findings and non-blocking cleanup. Use RED first for observable behaviour; use the
project's documented TDD exception and proportionate verification for behaviour-preserving work.
Self-review, run focused checks and `<full-suite>`, and resolve regressions caused by the axis. Make
no empty commit; when tracked changes are needed, commit them together once by explicit path under
`<write boundary>` and `<commit convention>`. Do not write the plan, runtime report or external systems.

Return at most 12 lines: status `complete | blocked`; receipt path; final HEAD and optional commit;
commands with exit codes and deciding observations. `blocked` is only for a required user decision,
authorization or unavailable real input; include the exact unresolved clause.

## Do not write the verdict into either review prompt

Keep spec verification and code review separate. Constrain scope and method, never conclusions: remove phrases such as “no need to inspect,” “do not flag,” “at most minor,” or “already decided.”

# Dispatch prompts

## What every dispatch shares

- Fill every `<>` slot from the spec, plan or workspace. Point to files instead of pasting session history.
- Resolve `cheap` / `mid` / `strong` against models available now; never invent a model id.
- Bound the return to findings/evidence/status, not a working transcript.
- A subagent reports; it never sets plan state.

## Writable wrap-up axis

Every axis receives `<workspace>`, `<range>`, `<pre-head>`, `<receipt>`, `<full-suite>`, `<commit convention>` and `<write boundary>`. Start there; require a clean tree and exact HEAD. Initialize the ignored receipt as `running`, then finish it atomically with axis, pre/final HEAD, status, optional commit, each finding and the action taken, and each deciding command/exit code/observation. An interrupted invocation resumes that receipt and work instead of restarting from the base.

Fix all owned findings and non-blocking cleanup. Use RED first for observable behaviour; for behaviour-preserving work use the project's documented TDD exception and proportionate verification. This is the axis's only pass: review your own fixes here. Run focused checks and `<full-suite>`; resolve regressions caused by the axis. Make no empty commit; commit tracked changes together once by explicit path under `<write boundary>` and `<commit convention>`. Do not write the plan, runtime report or external systems.

Return at most 12 lines: status `complete | blocked`; receipt path; final HEAD and optional commit; finding/action summary; commands with exit codes and deciding observations. `blocked` is only for a required user decision, authorization or unavailable real input; include the unresolved clause.

## Do not write the verdict into either review prompt

Keep spec verification and code review separate. Constrain scope and method, never conclusions: remove phrases such as “no need to inspect,” “do not flag,” “at most minor,” or “already decided.”

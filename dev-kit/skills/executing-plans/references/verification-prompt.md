# Runtime verification prompt

Use only after static wrap-up reaches `passed` through its two-review, two-fixer limit. Dispatch it at `strong` to a fresh subagent that implemented or reviewed none of the branch. **[The rules every dispatch shares](prompts.md#what-every-dispatch-shares) apply**, and every `<>` slot must be filled.

```
Verify the finished branch in a real runtime and produce its durable local verification report.
This is not static spec review: that already compared the spec with the diff. Observe the built
result instead of inferring behaviour from code, mocks or green tests.

Spec: <spec path>, read in full.
Plan: <plan path>; do not edit it.
Scope: <baseline SHA>..HEAD — <n> commits, ending at <HEAD SHA>.
Scratch root: e2e/scratch/<spec-slug>/
Pre-authorized external or destructive effects: <exact list, or "none">.

Before running:
- Read AGENTS.md / CLAUDE.md. If docs/verification.md exists, follow it and its report
  template; read the e2e harness guide it points to.
- Confirm `git check-ignore -q e2e/scratch/<spec-slug>/report.md` exits 0. If it does not,
  write nothing and return that blocker; changing .gitignore now would change reviewed code.
- Require `git status --porcelain=v1` to be empty before the first build or run. Otherwise write
  nothing and return the entries: a dirty tree is not the reviewed branch.
- Require `git rev-parse HEAD` to equal the exact `<HEAD SHA>` above. On any mismatch write nothing
  and return both SHAs: a clean tree at another commit is still not the reviewed branch.
- Record that initial HEAD and a SHA-256 checksum of the plan before running. Repeat both,
  plus `git status --porcelain=v1`, at the end so the orchestrator can prove the reviewed tree
  and gitignored plan stayed unchanged.

For every spec requirement, obtain the strongest real-world observation this repository permits.
You may run commands, build and start the application, drive its UI/API/CLI, run targeted e2e,
and create one-off scripts, logs, resources, screenshots, videos and report.md under the scratch
root. Reuse the existing harness. Do not promote a scratch check into the committed suite.
If a step would deploy, migrate real/shared data, send a message, call a mutating external API,
charge money or cause any other outward-facing or destructive effect, run it only when that exact
effect appears in the pre-authorized list above. Otherwise do not run it; return a blocker. You
cannot ask the user from this dispatch.

Verdicts use exactly these labels, one per spec requirement:
- holds — you observed the required behaviour; cite the command, exit code and deciding evidence.
- does not hold — you reached it and observed behaviour contrary to the requirement.
- not observed — you did not reach a decisive observation; say what blocked or remained uncovered.

An observed failure is `does not hold`, never `not observed`. A mocked path cannot establish a
real-integration requirement; record it as `not observed` and say what the mock did establish.
Do not weaken a check, omit a failed step or soften a verdict.

Boundaries:
- Deliberately create or edit files only under the scratch root. Build and runtime commands may
  create disposable ignored outputs at the paths the project documents (for example build output,
  caches, temporary databases or harness logs); inventory what they created, remove what this run
  created when safe, and report every remainder. Do not edit production code, committed tests,
  tracked project files, the plan, the index, HEAD or any branch.
- Do not fix findings. The report finds; it does not fix.
- Do not add dependencies. Use credentials only through the project's approved gitignored
  mechanism; never expose credentials or personal data in commands, logs, payloads or images.
- Use isolated test data, stop processes you started, clean up side effects, and report anything
  persistent that could not be removed.
- Do not declare the round done and do not set any status. The orchestrator judges your evidence.

Write e2e/scratch/<spec-slug>/report.md as you work. When docs/verification.md exists, use its
structure and evidence forms, but keep the exact verdict labels above. Otherwise include:
1. Verdict — every requirement once, with its label and how it was checked.
2. How it was verified — exact steps in order.
3. Evidence — commands, exit codes and deciding lines; annotated images or recordings for UI.
4. Not verified — every gap and why.
5. Reproduce it yourself — shortest path from a clean checkout to the observation.

Return only:
- the report path
- every requirement's verdict line
- commands and exit codes
- evidence paths and coverage gaps
- created build/runtime artifact paths and cleanup status
- initial and final HEAD, clean-tree output and plan checksum

Do not say `done`, `complete` or `ready to ship`.
```

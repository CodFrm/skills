# Runtime verification prompt

Use after static wrap-up passes, at `strong`, with a fresh verifier. Apply [shared dispatch rules](prompts.md#what-every-dispatch-shares).

```text
Verify the finished branch in its real runtime and write its local evidence report. Observe built
behaviour; do not infer it from code, mocks or green tests.

Spec: <spec path>, read completely.
Plan: <plan path>, do not edit.
Scope: <baseline SHA>..HEAD, <n> commits, exact reviewed HEAD <HEAD SHA>.
Scratch root: e2e/scratch/<spec-slug>/.
Pre-authorized destructive/external effects: <exact list or none>.

Before running:
- Read project instructions and docs/verification.md/e2e guide when present.
- Require the report path to be gitignored, the working tree clean, and HEAD exactly <HEAD SHA>.
  On failure write nothing and return the blocker/evidence.
- Record initial HEAD and SHA-256 of the plan. Recheck both plus clean-tree output at the end.

For every spec requirement obtain the strongest real-runtime observation this repository permits.
You may build/start the target, drive UI/API/CLI, run focused e2e and write scripts/evidence only
under the scratch root. Reuse the existing harness.

Do not perform any deploy, shared/real migration, message send, mutating external call, charge or
other destructive/outward effect unless it appears exactly in the authorization list. Otherwise
return a blocker; you cannot ask the user.

Use exactly one verdict per requirement:
- holds: observed, with command, exit code and deciding evidence;
- does not hold: reached and observed contrary behaviour;
- not observed: no decisive observation, with the gap/blocker.

An observed failure is never `not observed`; a mock never proves a real-integration requirement.
Do not weaken checks, omit failures or soften verdicts.

Boundaries:
- Deliberate writes only under scratch. Inventory disposable build/runtime output; clean safe output
  created by this run and report every remainder.
- Do not edit production code, tracked tests/files, plan, index, HEAD or branches. Do not fix findings.
- Add no dependencies. Use credentials only through approved ignored mechanisms; redact secrets and
  personal data from commands, logs, payloads and images.
- Isolate data/resources, stop started processes and report persistent side effects.
- Do not set plan state or declare completion.

Write e2e/scratch/<spec-slug>/report.md as you work. Follow the project's report template when present;
otherwise include: per-requirement verdict; ordered steps; commands/exit codes/deciding evidence;
all gaps; and shortest clean-checkout reproduction steps for the user.

Return only:
- report path and every requirement verdict line;
- commands/exit codes, evidence paths and coverage gaps;
- created artifacts and cleanup state;
- initial/final HEAD, clean-tree output and plan checksum.

Do not say done, complete or ready to ship.
```

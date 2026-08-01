<!-- Replace project commands/runtime placeholders; delete unused sections and this comment. This file owns when/how to run one-off real-runtime verification. -->

# Feature verification

## When to skip this guide

Use targeted committed tests alone when they fully observe the changed logic. Use this guide when real UI/process/API/external wiring is needed, or when reproducing a runtime-only bug. It does not replace TDD.

## Workflow

1. Run `<typecheck/lint>` and the targeted tests; run the full suite only when risk/gate requires it.
2. Build/start the drivable target with `<commands>`.
3. Write a one-off script under gitignored `e2e/scratch/<task-name>/`, reusing the harness in [`../e2e/README.md`](../e2e/README.md).
4. Before running, create `report.md` from [`references/verification-report-template.md`](references/verification-report-template.md); update it as evidence arrives.
5. Record exact commands, exit codes, deciding runtime observations, gaps and shortest user reproduction steps.

```bash
<run one scratch scenario>
<filter one scenario>
```

For acceptance against a spec, `<task-name>` is the spec slug. Extract each requirement from design prose into one verdict row and evidence section. Verdict labels are `holds`, `does not hold`, `not observed`.

For bug reproduction, state whether the scratch asserts expected behaviour (red until fixed) or current buggy behaviour (green until fixed), then turn the reproduction into a committed RED test unless [`testing.md`](testing.md#exceptions-to-tdd) grants the manual-evidence exception.

Never weaken an assertion, skip a failed step or describe red as green. For background/runtime effects, use a specific structured log/metric/data change plus an independent oracle; “no errors” is not evidence. Obtain authorization before destructive or external side effects.

## Maintaining this route

Verify that documented commands exist, the main e2e config excludes scratch, the scratch config targets it, and `.gitignore` covers `e2e/scratch/`. Follow [`documentation.md`](documentation.md) after path/harness changes.

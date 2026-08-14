<!-- Replace project commands/runtime placeholders; delete unused sections and this comment. This file owns when/how to run one-off real-runtime verification. -->

# Feature verification

## When to skip this guide

Use targeted committed tests alone when they fully observe the changed logic. Use this guide when real UI/process/API/external wiring is needed, or when reproducing a runtime-only bug. It does not replace TDD.

## Workflow

1. Run `<typecheck/lint>` and the targeted tests; run the full suite only when risk/gate requires it.
2. Build/start the drivable target with `<commands>`. Only the target starts here: a real external dependency is reached through `.env`, and configuration it lacks is asked for, not arranged around ([`../e2e/README.md`](../e2e/README.md)).
3. Choose the cheapest form that observes the contract, and put everything it produces under gitignored `e2e/scratch/<scenario>/`:

   | To reach and observe the target | You author |
   |---|---|
   | an existing command or entry point suffices, and it neither depends on nor writes your own machine state | nothing — drive it yourself and read the oracle |
   | it needs a specific launch, isolated state or real-target configuration, and the observation is one-off | a launcher that stops at the target; drive it yourself |
   | the sequence must be replayed, or timing/concurrency is the contract | a full scratch script |

   This project: `<surface → form and entry point>`.

   Reuse the harness in [`../e2e/README.md`](../e2e/README.md) for isolation and the oracle, not its fixtures. In every form one observation comes from a path the driven surface does not share — `<persisted data / structured log / read-only endpoint / output file>` — and it is copied into the scenario directory while the run that produced it is still alive.
4. Before running, create `report.md` from [`references/verification-report-template.md`](references/verification-report-template.md); update it as evidence arrives.
5. Record how the target was driven, exit codes where the form produces them, deciding runtime observations, gaps and shortest user reproduction steps.

```bash
<run one scratch scenario>
<filter one scenario>
```

For acceptance against a spec, `<scenario>` is the spec slug. Extract each requirement from design prose into one verdict row and evidence section. Verdict labels are `holds`, `does not hold`, `not observed`.

For bug reproduction, state whether the reproduction asserts expected behaviour (red until fixed) or current buggy behaviour (green until fixed), then turn it into a committed RED test unless [`testing.md`](testing.md#exceptions-to-tdd) grants the manual-evidence exception. Choosing a form that authors nothing does not remove that test.

Never weaken an assertion, skip a failed step or describe red as green. For background/runtime effects, use a specific structured log/metric/data change; “no errors” is not evidence. Obtain authorization before destructive or external side effects, and before substituting a mock for a real dependency — the verdict row then names what stood in and what it does not cover.

## Maintaining this route

Verify that documented commands exist, the main e2e config excludes scratch, the scratch config targets it, and `.gitignore` covers `e2e/scratch/`. Follow [`documentation.md`](documentation.md) after path/harness changes.

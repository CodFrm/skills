<!-- Replace project placeholders, delete unused sections and this comment. TDD loop itself stays in AGENTS/dev-kit; this file owns test design. -->

# Testing

## Applicability gate

Start from the changed contract. Add cases only for applicable behaviour: thresholds/edges, invalid input/failures, state/lifecycle, ordering/concurrency, compatibility/security, process/external boundaries, or mechanical source conventions. If none apply, one representative happy path is enough.

Before writing a test, state:

1. observable contract;
2. triggering input/state/sequence;
3. observable outcome;
4. plausible wrong implementation the test rejects.

## Choosing a test boundary

Choose the narrowest boundary that observes the real contract:

| Contract | Boundary |
|---|---|
| parsing/mapping/validation/state logic | unit |
| rendered state/accessibility/interaction/variant mapping | focused component |
| persistence/retry/order/lifecycle across objects | service/repository |
| real process/API/build wiring | integration/e2e |
| stable automation not feasible | [one-off runtime verification](verification.md) |

## Covering the behaviour space deliberately

Start with one happy path, then cover each applicable distinct branch/equivalence class:

- boundary values and empty/omitted/duplicate inputs;
- dependency error, denial, timeout, cancellation and rollback/unchanged state;
- repeated calls, stale async completion and cleanup;
- out-of-order/overlapping operations only when promised;
- legacy/platform/untrusted-input/permission/payload limits only when owned by the contract.

Do not multiply ordinary samples down the same branch. A bug regression stays close enough to the confirmed failure that restoring the cause makes it red.

## Assertions, mocks and fixtures

Assert returned/rendered/persisted/emitted behaviour. Assert collaborator calls only when that call is the contract. Avoid private structure/call counts and loose assertions that cannot distinguish wrong behaviour.

Mock external/expensive boundaries, preferably through `<shared project mocks>`. Assert what production code does with the mocked result, not that the mock returned its fixture. Keep fixtures minimal and discriminating.

## Exceptions to TDD

Only:

- genuinely behaviour-preserving refactor/type/deletion/rename/dependency work, verified proportionately;
- automation genuinely infeasible, verified manually with retained evidence.

Neither exception is granted by file type or task label.

## Writing meaningful tests: what to delete and what not to write

Do not add tautologies, duplicate coverage, pass-through rendering, mock/framework tests, misleadingly named tests, or source-text assertions better expressed as a verified lint rule.

Keep thin tests that uniquely cover a branch, mapping, accessibility derivation, denylist/completeness invariant or historical regression.

## Scope and cleanup boundaries

Clean worthless tests only when they cover the changed behaviour/file or are directly replaced by the guardrail landing in this change. Otherwise report them or use a separate change. Before deletion, inspect the production path and search neighboring/unit/integration/e2e/guardrail coverage for the same contract; preserve unique error, security, lifecycle and regression signals.

Classify red/slow tests before changing them: production regression, stale contract, flaky shared-state/timing fault, misclassified real-I/O test, or truly redundant signal. Do not mask flakiness with retries/timeouts.

## How to run them

```bash
<targeted test command>
<full test command>
<coverage command>
<lint/typecheck command>
```

- Runner/assertion environment: `<real project tools>`.
- Test location/naming: `<real project convention>`.
- Shared fixtures/mocks: `<real entry points>`.

## Related

[`../AGENTS.md`](../AGENTS.md) · [`verification.md`](verification.md) · [`../e2e/README.md`](../e2e/README.md)

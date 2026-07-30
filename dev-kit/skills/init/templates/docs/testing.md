<!--
Template: docs/testing.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, delete any
section you do not need, and delete this comment block at the end.
Owns "how tests are designed, what to write, what not to write, how to run them". The TDD-first
principle itself lives in AGENTS.md — do not write it out in both places.
-->

# Testing

> **The TDD/BDD-first principle** is in [`../AGENTS.md`](../AGENTS.md#engineering-principles-non-negotiable). This file is the mechanism.

A test is not valuable because it raised coverage. It has to **protect an observable contract**, **go red on a real regression**, and cost less to maintain than the confidence it provides.

## The applicability gate — read this section first

Before designing or reviewing tests, look at which rows **the contract being changed** touches. Skip the rows that do not apply **without writing "N/A" in the PR** — that is ritual, not evidence.

| Does the contract involve… | If so, read |
|---|---|
| Thresholds, counts, sizes or other edge values | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — edge cases |
| Invalid input, rejected dependencies, failure paths | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — invalid/failure |
| State held across calls, async, lifecycles | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — state transitions |
| Ordering, concurrency, overlapping operations | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — ordering/concurrency |
| Legacy formats, cross-platform differences, untrusted input, permission scopes | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — compatibility/security |
| Real external APIs, process boundaries, several components wired together | [Choosing a test boundary](#choosing-a-test-boundary) — the integration/E2E row |
| A mechanical source-text convention (import bans, naming rules) | [Writing meaningful tests](#writing-meaningful-tests-what-to-delete-and-what-not-to-write) — file-text assertions |

None of the above → one happy-path test is enough. **Do not manufacture coverage for categories that do not apply.**

## State four things before writing a test

Start from behaviour, not from the current implementation:

1. **The contract** — what the caller or user can observe.
2. **The trigger** — what input, event, state or sequence reaches it.
3. **The outcome** — the return value, rendered state, persisted data, emitted message or external call that must result.
4. **The regression** — **a plausible wrong implementation this test would reject.**

**If you cannot state the fourth, the test is probably asserting an implementation detail or a tautology.** When fixing a bug, reproduce and capture the failure per [`verification.md`](./verification.md) first, then write the smallest test that goes red for that confirmed cause.

### Choosing a test boundary

**The narrowest boundary that can observe the real contract:**

| The contract's character | Test boundary |
|---|---|
| Parsing, mapping, validation, selection, state-transition logic | A pure unit test |
| Conditional rendering, accessibility derivation, interaction, variant→token mapping | A focused component render test |
| Persistence, messaging, retries, ordering, lifecycles across object boundaries | A service / repository test |
| Real external APIs, process boundaries, build entry points, several components wired together | An integration / E2E test — **do not stuff it into a heavily mocked unit test because that is cheaper** |
| Permanent automation genuinely not feasible, or costing more than the regression risk it prevents | [One-off verification](./verification.md) |

### Covering the behaviour space deliberately

Start with the **happy path**, then add the edges and failure paths that would change the result, per the gate above. **The floor is one happy path + one edge or failure case the contract genuinely owns.** When not a single gate row is hit, that one happy path is the whole thing and **you do not manufacture a second to make up the numbers** — and equally, do not stop at a happy path when a gate row does apply.

| Category | What it covers |
|---|---|
| Happy path | A representative valid input produces the expected observable result |
| Edge cases | Empty input, a single element; first/last; exactly at the limit; either side of a threshold; omitted optional fields; duplicates. Unicode / special paths **only when the code genuinely branches on them** |
| Invalid/failure | Malformed input, a dependency erroring, permission denied, timeout, cancellation, partial data. Assert whether the contract rejects, reports, retries, rolls back or stays unchanged |
| State transitions | Before and after state, repeated calls, idempotency, cleanup, unsubscribing; whether a stale async result can overwrite a newer one |
| Ordering/concurrency | Out-of-order completion, overlapping operations, deduplication, exactly-once — **only when the production code promises these** |
| Compatibility/security | Legacy formats, platform branches, untrusted URLs/paths, permission scopes, payload limits — **only when it is part of the contract** |

**Choose samples by equivalence class and branch, not by count:**

- `value === limit`, `< limit` and `> limit` produce three different results → **three branches**, all tested.
- Ten ordinary strings down the same path → **one equivalence class**, one representative.
- An empty array earns its own case only when "empty" changes the behaviour.

When fixing a bug, add a regression case **close enough to the confirmed failure that putting the cause back makes it red**. If the fix may have narrowed previously supported behaviour, keep a happy-path assertion too.

### Assert the outcome, not incidental structure

- Assert the returned domain value, the persisted record, the visible state, the accessibility attributes, the emitted message, or **necessary** collaborator calls.
- Assert a collaborator call only when **the call is itself the contract** ("must not write before approval", "publishes exactly once"). Do not assert every internal call along the path.
- Prefer exact assertions for structured output; a loose `contains` only when the omitted detail sits outside the contract.
- **A test's name must describe what its body actually triggers and observes.** `works`, `test1` and a bare bug number are banned.

### Mocks and fixtures

**Mock at external or expensive boundaries, not on every internal function.** A good mock makes the test deterministic while keeping the production path under test.

- Prefer the repository's shared mocks: <list this repository's shared mock entry points>.
- Give the mock only the behaviour this scenario needs, staying structurally compatible with the narrow interface the subject consumes.
- **Assert how our code transforms, routes, persists or responds to what the mock returned — never that the mock returned what it was configured to return.**
- Keep fixtures small enough that the meaningful difference is visible at a glance.

## Exceptions to TDD

Only two, **neither a blanket rule by file or task category**; everything else writes the failing test first:

- **Genuinely behaviour-preserving work** — refactors, type cleanups, deleting dead code, mechanical renames, a config/dependency upgrade confirmed not to change behaviour. **Verify** it rather than **testing** it.
- **Automation genuinely not feasible** — purely visual/motion adjustments, a bug reproducible only on one platform or lifecycle stage, copy changes, platform behaviour that cannot be automated stably. **Verify manually and keep the evidence**; do not commit a pass-through test to satisfy a rule. Where driving the real application is needed, go through [`verification.md`](./verification.md).

## Writing meaningful tests (what to delete and what not to write)

**Do not conflate two situations.** A test failing because **the contract it asserts is wrong** (a stale fixture, an assertion wrong from the start, a contract that genuinely changed) → fix the test and state why. A test that **has never brought value whether red or green** → clean it up regardless. **Neither is a licence to weaken a valid regression test to make CI green.**

Do not write these, and delete them within the [cleanup boundaries](#scope-and-cleanup-boundaries) when you meet them (delete the test, do not touch the business logic):

- **Tautology** — asserting a constant equals its own literal definition.
- **Genuine duplication** — a file or block nearly word-for-word identical to another.
- **Redundancy** — the caller's test already covers the callee fully.
- **Pure pass-through rendering** — asserting only that a prop appeared, with no branching, mapping or derivation in the component.
- **Testing the mock or the framework** — configuring an `fn()` then asserting it returned what it was fed; asserting a third-party library's or the language's own semantics.
- **Name not matching content** — the body never triggers the behaviour the name claims. **Worse than no test: it gives false confidence.**
- **A file-text assertion that should be a lint rule** — grepping source text is a mechanical convention. **The replacement guardrail lands and is verified before this test is deleted.**

These **look thin but stay**: one branch of a condition; variant → design token mapping and accessibility derivation; regression guards (a custom Error subclass's `instanceof`, the completeness of a security denylist); the **only** coverage of a component.

### Judging the grey areas

| Question | How to judge |
|---|---|
| Observable contract vs implementation detail? | The caller/user can perceive this value changing → a contract. Only the source structure changed → an implementation detail. |
| A different equivalence class vs another sample? | Different only when a plausible bug would make this input produce a **different** result from the covered case. |
| A necessary collaborator call vs an internal call assertion? | Assert the call only when not calling it (or calling it wrongly) is itself the bug being guarded against. |
| A valuable thin test vs a pass-through? | Branching, mapping or derivation → thin but valuable. A prop straight through with zero conditional logic → a pass-through. |

### Scope and cleanup boundaries

`AGENTS.md`'s scope discipline governs test cleanup too — **this makes it concrete rather than opening a loophole in it:**

| Situation | What to do |
|---|---|
| The worthless test is in a file this change already touches, or covers this change's behaviour | Clean it up in passing — in scope |
| It is in a file or behaviour this task does not touch | **Do not delete it in this PR.** Record it as an out-of-scope finding |
| It is a repository-wide pattern scattered across unrelated files | Do not bulk-clean here. Open a separate issue/PR scoped to that pattern |
| A cleanup already started turns out to span many unrelated files | Split it into its own PR |
| A replacement lint/structured guardrail directly substitutes for the deleted test | In scope — part of "replace, then delete" |

### Cleaning up tests safely

**Tests are a production dependency**, and **a failing or slow test is not automatically meaningless**. Classify before acting:

| Symptom | Classification | Handling |
|---|---|---|
| The asserted contract still holds and the production code violated it | A production regression | Fix the production code |
| The requirement genuinely changed, or the assertion was always wrong | A stale contract | Update or replace the test, recording the change |
| Timing, leaked global state or non-deterministic ordering changes the result | Flaky | Fix the root cause; **do not** add retries or raise the timeout without evidence |
| Real I/O cost exceeds a unit test's budget | Misclassified | Move it to the right test type or give it a measured budget |
| It hits a worthless category above, and deleting loses no independent regression detection | Worthless | Delete it within the [cleanup boundaries](#scope-and-cleanup-boundaries) |

**Verify against the source, entry by entry, before deleting** — many tests that look pointless cover a real branch:

1. Read the production path it claims to cover; **do not** judge from the name or line count.
2. Search for the same contract in neighbouring unit tests, caller tests, integration tests, E2E, lint rules and structured scans.
3. State the regression it can reject. If another test would also go red for it, **show your evidence** — a similar setup does not prove duplication.
4. Check whether it is the only coverage of a branch, an error path, a security boundary, a lifecycle event or a historical regression.
5. Delete only the redundant signal, not assertions covering a different branch.

## How to run them

<!-- Must carry commands that really exist; run each one before writing it in. Selection order:
     package-manager script > Makefile target > bare command. The same entry point used by
     develop.md, pre-commit and CI. -->

```bash
<full test command>
<single-file / targeted test command>
<coverage command>
<lint / typecheck command>
```

- Test files live in <location convention>, named <naming convention>.
- <runner/framework> + <assertion library/DOM environment>.
- <This repository's particular mock wiring location>.

### Performance hygiene

<!-- Keep for projects with a history of tests slowing down; a new project can delete it -->

- **A separate time budget per test type**, rather than one flag blanketing every timeout.
- A genuinely CPU-heavy case gets **its own** explicit timeout, with the measured solo runtime in a comment; the global budget stays tight.
- **Do not use real sleeps.** Fake timers for timing behaviour; a short real delay only when the delay is itself the regression being guarded against.
- Treat a performance measurement as evidence, not one run's verdict. **Never mask a slow query by raising the timeout.**

## Related documents

- Engineering principles (TDD-first, fix the root cause, scope discipline) → [`../AGENTS.md`](../AGENTS.md)
- Driving the real application for end-to-end verification → [`verification.md`](./verification.md)
- Smoke e2e vs local verification e2e → [`../e2e/README.md`](../e2e/README.md)

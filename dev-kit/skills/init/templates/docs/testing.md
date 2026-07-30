<!--
Template: docs/testing.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, delete any
section you do not need, and delete this comment block at the end.
This file owns "how tests are designed, what to write, what not to write, how to run them".
The TDD-first principle itself lives in AGENTS.md; only the mechanism and the exceptions go
here — do not write it out in both places.
-->

# Testing

> **The TDD/BDD-first principle** is in [`../AGENTS.md`](../AGENTS.md#engineering-principles-non-negotiable). This file is the mechanism.

A test is not valuable because it "raised coverage". It has to **protect an observable contract**, **go red on a real regression**, and cost less to maintain than the confidence it provides.

---

## The applicability gate — read this section first

Not every section applies to every change. Before designing or reviewing tests, look at which rows **the contract being changed** touches. Skip the rows that do not apply **without writing "N/A" in the PR** — that is ritual, not evidence.

| Does the contract involve… | If so, read |
|---|---|
| Thresholds, counts, sizes or other edge values | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — edge cases |
| Invalid input, rejected dependencies, failure paths | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — invalid/failure cases |
| State held across calls, async, lifecycles | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — state transitions |
| Ordering, concurrency, overlapping operations | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — ordering/concurrency |
| Legacy input formats, cross-platform differences, untrusted input, permission scopes | [Covering the behaviour space](#covering-the-behaviour-space-deliberately) — compatibility/security |
| Real external APIs, process boundaries, several components wired together | [Choosing a test boundary](#choosing-a-test-boundary) — the integration/E2E row |
| A mechanical source-text convention (import bans, naming rules) | [Writing meaningful tests](#writing-meaningful-tests-what-to-delete-and-what-not-to-write) — file-text assertions |

None of the above → one happy-path test is enough. **Do not manufacture coverage for categories that do not apply.**

---

## State four things before writing a test

Start from behaviour, not from the current implementation. Before writing an assertion, state:

1. **The contract** — what the caller or user can observe.
2. **The trigger** — what input, event, state or sequence reaches this contract.
3. **The outcome** — the return value, rendered state, persisted data, emitted message or external call that must result.
4. **The regression** — **a plausible wrong implementation this test would reject.**

**If you cannot state the fourth, the test is probably asserting an implementation detail or a tautology.** When fixing a bug, reproduce and capture the failure per [`verification.md`](./verification.md) first, then write the smallest test that goes red for that confirmed cause.

### Choosing a test boundary

**Choose the narrowest boundary that can observe the real contract:**

| The contract's character | Test boundary |
|---|---|
| Parsing, mapping, validation, selection, state-transition logic | A pure unit test |
| Conditional rendering, accessibility derivation, interaction, variant→token mapping | A focused component render test |
| Persistence, messaging, retries, ordering, lifecycles across object boundaries | A service / repository test |
| Real external APIs, process boundaries, build entry points, several components wired together | An integration / E2E test — **do not stuff it into a heavily mocked unit test just because that is cheaper** |
| Permanent automation genuinely not feasible, or costing more than the regression risk it prevents | [One-off verification](./verification.md) |

### Covering the behaviour space deliberately

Start with the **happy path**, then add the edges and failure paths that would change the result, per the gate above. **The floor is one happy path + one edge or failure case the contract genuinely owns** — that is the criterion for the TDD entry in [`../AGENTS.md`](../AGENTS.md). When not a single gate row is hit (no threshold, no failure path, no state across calls), that one happy path is the whole thing, and **you do not manufacture a second to make up the numbers**. Conversely, do not stop at a single happy path either, and certainly do not mechanically enumerate a pile of inputs down the same branch.

| Category | What it covers |
|---|---|
| Happy path | A representative valid input runs through and produces the expected observable result |
| Edge cases | Empty input, a single element; first/last element; exactly at the limit; one either side of a threshold; omitted optional fields; duplicates. Unicode / special paths get tested **only when the code genuinely branches on them** |
| Invalid/failure | Malformed input, a dependency erroring, permission denied, timeout, cancellation, partial data. Assert whether the contract rejects, reports, retries, rolls back or stays unchanged |
| State transitions | Before and after state, repeated calls, idempotency, cleanup, unsubscribing; whether a stale async result can overwrite a newer one |
| Ordering/concurrency | Out-of-order completion, overlapping operations, deduplication, exactly-once — **only when the production code genuinely promises these** |
| Compatibility/security | Legacy formats, platform branches, untrusted URLs/paths, permission scopes, payload limits — **only when it is part of the contract** |

**Choose samples by equivalence class and branch, not by sample count:**

- `value === limit`, `value < limit` and `value > limit` produce three different results → all three get tested. Those are **three branches**, not three samples of one thing.
- Ten ordinary strings down the same path → one representative is enough. That is **one equivalence class**, however many inputs it has.
- An empty array deserves its own case only when "empty" changes the behaviour; down the same branch with the same assertion it is redundant.

When fixing a bug, add a regression case whose conditions sit close to the confirmed failure scenario — **close enough that putting the cause back makes it red**. If the fix may have incidentally narrowed previously supported behaviour, keep a happy-path assertion as well.

### Assert the outcome, not incidental structure

- Assert the returned domain value, the persisted record, the visible state, the accessibility attributes, the emitted message, or **necessary** collaborator calls.
- Assert a collaborator call only when "the call is itself the contract" ("must not write before approval", "publishes exactly once"). **Do not** assert every internal call along the path.
- Prefer exact assertions for structured output. Use a loose `contains` / truthiness assertion only when the omitted detail genuinely sits outside the contract.
- **A test's name must describe what its body actually triggers and observes.** `works`, `test1`, and a bare bug number with no behaviour are banned.

### Mocks and fixtures

**Mock at external or expensive boundaries, not on every internal function.** A good mock makes the test deterministic while keeping the production path under test.

- Prefer the repository's shared mocks: <list this repository's shared mock entry points>.
- Give the mock only the behaviour this scenario needs, while staying structurally compatible with the narrow interface the subject consumes.
- **Assert "how our code transforms/routes/persists/responds to what the mock returned" — never assert "the mock returned what it was configured to return"** (that is testing the mock).
- Keep fixtures small enough that the meaningful difference is visible at a glance.

---

## Exceptions to TDD

There are only two, **neither of them a blanket rule by file or task category**; everything else writes the failing test first:

- **Genuinely behaviour-preserving work** — refactors, type cleanups, deleting dead code, mechanical renames, or a config/dependency upgrade confirmed not to change behaviour. **Verify** it rather than **testing** it.
- **Automation genuinely not feasible** — purely visual/motion adjustments, a bug reproducible only on a particular platform or lifecycle stage, copy wording changes, platform behaviour that cannot be automated stably. **Verify manually and keep the evidence**; do not commit a pass-through or low-value test to satisfy a rule — when driving the real application is needed, go through [`verification.md`](./verification.md), otherwise record a simple note of the check.

---

## Writing meaningful tests (what to delete and what not to write)

**Do not conflate two situations.** A test failing because **the contract it asserts is wrong** (a stale fixture, an assertion that was wrong from the start, a contract that genuinely changed) → fix the test and state why. A test that **has never brought value whether red or green** (see below) → clean it up regardless of whether it is currently red. **Neither is a licence to weaken a valid regression test to make CI green.**

Do not write the following "tests nothing" types, and delete them within the [cleanup boundaries](#scope-and-cleanup-boundaries) when you meet them (delete the test, do not touch the business logic):

- **Tautology** — asserting a constant equals its own literal definition (source `const FOO = [Type.BAR]`, test `expect(FOO).toEqual([Type.BAR])`).
- **Genuine duplication** — a whole file/block nearly word-for-word identical to another, differing only in an irrelevant suffix.
- **Redundancy** — the caller's test already covers the callee fully, so the callee does not need a separate unit test as well.
- **Pure pass-through rendering** — `render(<Comp prop={x} />)` asserting only that `x` appeared, with no branching/mapping/derivation logic in the component.
- **Testing the mock or the framework rather than our code** — configuring an `fn()` then asserting it returned what it was fed; asserting the semantics of a third-party library or the language itself.
- **Name not matching content** — the body never triggers the behaviour the name claims (the name says it tests cancellation, the body never calls cancel). **Worse than no test: it gives false confidence.**
- **A file-text assertion that should be a lint rule** — reading a source file and grepping its text is a mechanical convention and belongs in a lint rule or a structured scanning test. **The replacement guardrail lands and is verified before this test is deleted.**

Conversely, the following **look thin but stay**:

- One branch of a condition (`showLabel` default vs hidden, an optional prop present vs absent).
- variant → design token mapping, and accessibility derivation (`title` → `aria-label`).
- Regression guards such as a custom Error subclass's `instanceof` / `name` guard, or the completeness of a security denylist.
- The **only** coverage of a component/subcomponent — deleting it deletes coverage, not noise.

### Judging the grey areas

| Question | How to judge |
|---|---|
| Observable contract vs implementation detail? | The caller/user can perceive this value changing → a contract. Only the source structure changed (a variable name, an internal helper split out) → an implementation detail, not worth its own test. |
| A different equivalence class vs another sample of the same one? | It is a different class only when "a plausible bug would make this input produce a **different** result from the already-covered case". |
| A necessary collaborator call vs an internal call assertion? | Assert the call only when "not calling it (or calling it wrongly) is itself the bug this test guards against". Otherwise assert the outcome. |
| A valuable thin test vs a pass-through? | The component has branching, mapping or derivation → thin but valuable. Rendering a prop straight through with zero conditional logic → a pass-through. |

### Scope and cleanup boundaries

`AGENTS.md`'s scope discipline governs test cleanup too. **This section makes it concrete rather than opening a loophole in it:**

| Situation | What to do |
|---|---|
| The worthless test is in a file this change already has to touch, or directly covers this change's behaviour | Clean it up in passing — in scope. |
| The worthless test is in a file/behaviour this task does not touch | **Do not delete it in this PR.** Record it as an out-of-scope finding (a follow-up issue / task). |
| What you found is a repository-wide pattern (the same worthless shape scattered across many unrelated files) | Do not bulk-clean here. Open a separate issue/PR scoped to that pattern. |
| A cleanup already started turns out to span many unrelated files | Split it into its own PR rather than inflating the current one. |
| A replacement lint/structured guardrail is the direct substitute for the test being deleted | In scope — part of "replace, then delete", not a repository-wide lint rollout. |

### Cleaning up tests safely

**Tests are a production dependency.** Stale or meaningless tests should be deleted, but **a failing or slow test is not automatically meaningless**. Classify before acting:

| Symptom | Classification | Handling |
|---|---|---|
| The asserted contract still holds and the production code violated it | A production regression | Fix the production code. |
| The requirement genuinely changed, or the assertion was wrong from the start | A stale/wrong contract | Update or replace the test, recording the contract change. |
| Timing, leaked global state or non-deterministic ordering changes the result | Flaky | Reproduce and fix the root cause; **do not** add retries or raise the timeout without evidence. |
| Real I/O cost exceeds a pure unit test's budget | Misclassified | Move it to the right test type or give it a measured budget; do not delete behaviour and do not relax the budget globally. |
| It hits a worthless category above, and deleting it loses no independent regression detection | A worthless test | Delete it within the [cleanup boundaries](#scope-and-cleanup-boundaries); do not keep it for a coverage number. |

**Verify against the source, entry by entry, before deleting or merging** — judging in bulk from a skim misfires badly, and many tests that "look pointless" actually cover a real branch:

1. Read the production path it claims to cover; **do not** judge from the name or the line count.
2. Search for the same contract in neighbouring unit tests, caller tests, integration tests, E2E, lint rules and structured scans.
3. State the mutation/regression it can reject. If another test would also go red for the same regression, **show your evidence**; a similar setup or output does not prove duplication.
4. Check whether it is the only coverage of a conditional branch, an error path, a security boundary, a lifecycle event or a historical regression.
5. Delete only the redundant signal, not assertions covering a different branch.

---

## How to run them

<!-- This section must carry commands that really exist; run each one before writing it in.
     Selection order: use the package-manager script if there is one (npm run test), otherwise a
     Makefile target (make test), and only then a bare command. It must be the same entry point
     used by develop.md, pre-commit and CI. -->

```bash
<full test command>
<single-file / targeted test command>
<coverage command>
<lint / typecheck command>
```

- Test files live in <location convention>, named <naming convention>.
- <runner/framework> + <assertion library/DOM environment>.
- <This repository's particular mock wiring location, e.g. a global setup file>.

### Performance hygiene

<!-- Keep this section for projects with a history of tests slowing down; a new project can
     delete it -->

- **A separate time budget per test type**, rather than a command-line flag blanketing every project's timeout.
- An individual case genuinely CPU-heavy → give **that one** an explicit timeout, with the measured solo runtime in a comment; keep the global budget tight.
- **Do not use real sleeps.** Use fake timers for timing behaviour; use a short real delay only when "the delay is itself the regression being guarded against".
- Treat a performance measurement as evidence, not as one run's verdict: repeat with the same command, reporter, files and environment. **Never mask a slow query or a slow wait by raising the timeout.**

---

## Related documents

- Engineering principles (TDD-first, fix the root cause, scope discipline) → [`../AGENTS.md`](../AGENTS.md)
- Driving the real application for end-to-end verification → [`verification.md`](./verification.md)
- The division of labour between smoke e2e and local verification e2e → [`../e2e/README.md`](../e2e/README.md)

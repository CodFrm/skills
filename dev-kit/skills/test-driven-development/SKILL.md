---
name: test-driven-development
description: >-
  Use when implementing new behaviour, fixing a reproducible bug, or changing a public contract — before any production code is written, and again whenever you catch yourself about to add tests to code that already exists. Not for: pure documentation, formatting, non-executable exploration, or mechanically syncing test expectations to an already-approved external change.
---

# Test-driven development (TDD)

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote the implementation first and are now adding tests to it? **Delete the implementation and start from the test.** Do not keep it in another file, do not read it while writing the test, do not "adapt" it once the test is green.

**One thing you may take off it first: the contract.** Where the behaviour is written down nowhere else — no spec, no caller, nothing in the docs — the sentence you are making true can only be read off the code, and refusing to look leaves you inventing a contract instead of testing the one that shipped. So read it once, [write that sentence down](#before-the-loop), and **then** delete it. What the ban is actually protecting is the *test* from being written against the implementation: once the sentence exists, the code has nothing left to tell you, and going back to it for the shape of an assertion is the thing that puts you back where you started.

That reads as waste, so here is what you are buying. **A test written against code that already exists is green the first time it runs, and green proves nothing here.** It may be asserting an implementation detail, asserting the branch you happened to remember rather than the one that breaks, or asserting nothing at all — and you cannot tell the difference, because you never saw it fail. Watching it go red for the missing behaviour is the entire proof that this test can catch this bug. Skip that and what you have is coverage, not protection.

## Where the rules live

Three files, and they do not repeat each other:

| | Owns |
|---|---|
| The project's `AGENTS.md` | That this project is TDD-first — the principle, stated to whoever contributes |
| The project's `docs/testing.md` | **How tests are designed**: choosing a boundary, covering the behaviour space and picking equivalence classes, mocks and fixtures, what is worthless and must not be written, how to clean tests up safely, how to run them — **and TDD's two exceptions** |
| This skill | **The loop**: what counts as red, what counts as green, how much one round covers |

**Read `docs/testing.md` before writing, changing or deleting any test.** Its applicability gate is what decides which cases this contract actually owes — do not infer that from principles, and do not infer the exceptions from them either. **Where the project has one, it is the only authority** — do not top it up from the template below, including on the sections it deliberately left out.

**If the project has no `docs/testing.md`**, take the design rules from [`../init/templates/docs/testing.md`](../init/templates/docs/testing.md) — the template `init` lands as that document. The applicability gate, the boundary table, equivalence classes, where to mock, what must not be written and the two exceptions are all in there, and none of that is project-specific. Two parts of it are not: `How to run them` and the shared-mocks bullet are `<angle bracket>` placeholders, so the real test command and file conventions still come from the repository itself — a package-manager script, a `Makefile` target, the CI workflow — and its links to `verification.md`, `../AGENTS.md` and `../e2e/README.md` point at documents a project without `init` does not have.

**Read that template; do not write it into the project**, and do not invent a standard of your own either: `init` lands it along with the lint guardrails and CI wiring that enforce it, and a second hand-rolled convention sitting beside that one is worse than none. Tell the user that `init` is what installs the document properly.

## Before the loop

**Have one sentence you are making true.** "Given this precondition, doing this, you observe this." If the project has an approved spec, take it from that spec's requirements and testing decisions — the seams there were already confirmed with the user, so use them rather than inventing your own, and the slice you are on says which requirement it serves. Without one, write the sentence yourself. **Not being able to write it means you do not yet know what you are building** — go read the code or ask, do not start typing tests.

**A bug needs a stable reproduction first** — `systematic-debugging` is what establishes one and locates the cause, and what it hands back is exactly the RED this loop starts from. A fix with nothing that reproduces the fault has no red to watch, and "it does not happen any more" is indistinguishable from "I did not trigger it this time".

**Pick the boundary before the first assertion**, per `docs/testing.md`'s boundary table: the narrowest one that can still observe the real contract. Do not pin private functions, DOM structure or call counts unless those are themselves the contract; equally, do not push logic that a unit test could observe into a heavily mocked test just because that is cheaper to write.

## The loop

Repeat for one minimal slice of behaviour.

### 1. RED — write the test

Write only enough test to express the missing behaviour.

**The floor for one slice is one happy path plus one edge or failure case the contract genuinely owns** — empty input, exactly at the limit, either side of a threshold, a dependency erroring, permission denied. When the contract really has no edge and no failure path, write the happy path and stop, rather than manufacturing a second case down the same branch to make up the numbers. Which cases a contract owes, and how to tell a new equivalence class from another sample of the same one, are in `docs/testing.md`.

### 2. Verify RED — mandatory, never skipped

Run it. Confirm it fails, **and that it fails because the target behaviour is missing**.

Four failures that are not red:

- the environment or a dependency will not install
- a syntax or import error
- a wrong fixture or wrong test setup
- **it was already failing on the baseline before you touched anything**

Fix the cause and re-run until it fails for the right reason.

**The test passed instead?** Then you are describing behaviour that already exists. Either this round adds nothing (so this test should not exist), or the assertion is too loose to tell the difference.

**Read the failure, do not just note its colour.** "It went red" is not the observation; "it failed at this assertion, expected X, got Y" is — that is what tells you the test is wired to the behaviour you think it is.

### 3. GREEN — the minimum implementation

Write the smallest amount of production code that makes that test pass. Do not implement capabilities that have no test yet while you happen to be in the file, and do not refactor neighbouring code in the same step.

### 4. Verify GREEN — mandatory

Run the target test first, then the affected suites.

When something else is red, classify it before touching anything: a **regression** you just caused (fix it now), a **baseline failure** that was red before you arrived (note it, do not adopt it), or an **environment problem**. **Do not edit a test to accommodate the implementation** — unless the contract itself genuinely changed, and then say so out loud and record why.

### 5. REFACTOR — while green

Remove duplication, improve names, straighten boundaries. Re-run the tests after each small step. No new behaviour goes in here.

---

**Every verification owes a command, an exit code and what you observed.** "Tests pass" on its own is not a verification; it is a recollection. Nothing has to be filed anywhere, but if you cannot say which command you ran and what it printed, you did not run it.

## The two exceptions

Both live in `docs/testing.md`, and **neither is a blanket rule by file or task category**:

- **Genuinely behaviour-preserving work** — a refactor, a type cleanup, deleting dead code, a mechanical rename, a dependency bump confirmed not to change behaviour. **Verify** it rather than **testing** it.
- **Automation genuinely not feasible** — purely visual or motion adjustments, a fault reproducible only on one platform or lifecycle stage, copy changes. Verify by hand and keep the record; do not commit a pass-through test to satisfy a rule.

"This one is special" is not on the list.

## Common rationalisations

| Excuse | Reality |
|---|---|
| "This code is obvious, write it and add tests after" | A test written against existing code is green on its first run. You never saw it fail, so nothing says it would fail if the behaviour broke. |
| "I already tested it by hand" | Manual testing keeps no record of what it covered, cannot be re-run when the code changes, and is the first thing dropped under time pressure. |
| "I need to explore the shape of this first" | Fine — explore. Then **throw the exploration away** and start from a test. Keeping it and bolting tests on is the same shortcut wearing a different word. |
| "Two hours in, deleting it is wasteful" | Sunk cost: those two hours are spent either way. The real choice is rewriting under TDD with high confidence, or keeping code you cannot vouch for and layering tests over it. |
| "Keep it as a reference and write the tests first" | You will write the tests against it. That is tests-after with an extra step. |
| "The happy path is green, this round is done" | If the contract has a threshold, a failure path or a state transition, the case that will actually regress is the one still missing. |
| "This is hard to test, so it is a special case" | Backwards. Hard to test is the design telling you something — hard to test is usually hard to use. |
| "More mocks means cleaner isolation" | Mocking private collaborators turns every refactor into a test rewrite. If you need isolation, raise the seam instead of adding mocks. |
| "The target test is green, so I am done" | The affected suites have not run. |
| "TDD is slower, I will be pragmatic this once" | It is faster for the twenty minutes you are writing the code and slower for every later change nobody dares make. |

## Red Flags

| Thought | Reality |
|---|---|
| "The test failed, so RED is done" | Only a failure caused by the missing target behaviour counts. Environment, syntax, fixture and baseline failures do not. |
| "That test was already red — close enough" | That is someone else's red. Establish the baseline first, then look at yours. |
| "Loosening this assertion makes it pass" | That is editing the test to fit the implementation. If the contract really changed, say so and record it; otherwise fix the code. |
| "I will implement this bit too while I am here" | Production code with no test behind it, whatever time of day it was written. |
| "Dispatch one subagent for RED and another for GREEN" | One round is tightly coupled — GREEN needs the specific failure output that RED produced. Dispatch the whole round, or none of it. |
| "It raises coverage, so it earns its place" | Coverage is not a reason. `docs/testing.md` lists a whole category of tests that assert nothing and raise coverage just fine. |
| "There is no `docs/testing.md`, I will write the conventions myself" | That is `init`'s job, guardrails and CI included. [Read the template `init` lands](#where-the-rules-live) for the design rules, and say the document is missing. |

## Before you call it done

- [ ] Every new behaviour has a test, and you watched each one fail
- [ ] Each failure was caused by the missing behaviour — not the environment, syntax, a fixture, or a baseline failure
- [ ] Each contract got a happy path plus the edge or failure case it genuinely owns, or it is stated that it has none
- [ ] The production code is the minimum that turns those tests green, with no untested capability smuggled in
- [ ] The target tests and the affected suites have both been run, and anything red is classified as regression, baseline or environment
- [ ] Assertions are on observable outcomes, not private structure or call counts — unless the call is itself the contract
- [ ] Every verification can name its command, its exit code and what you observed
- [ ] A bug fix's regression test goes red when the old implementation is put back

**Cannot tick them all? Then this was not TDD** — go back to the box that failed rather than reporting it done.

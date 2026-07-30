---
name: test-driven-development
description: >-
  Use when implementing new behaviour, fixing a reproducible bug or changing a public contract — before any production code is written, and the moment you catch yourself about to test code that already exists. Not for: syncing tests to an already-approved external change.
---

# Test-driven development (TDD)

**This is not a stage of the chain — it runs inside one.** You get here from a task under [`executing-plans`](../executing-plans/SKILL.md#the-loop), from the short route with no plan, or on its own. **This skill does not check whether a spec exists** — where there is none it writes the sentence itself, [below](#before-the-loop).

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote the implementation first and are now adding tests to it? **Delete the implementation and start from the test.** Do not keep it in another file, do not read it while writing the test, do not "adapt" it once the test is green.

**A test written against code that already exists is green the first time it runs, and green proves nothing here** — it may be asserting an implementation detail, or nothing at all, and you cannot tell, because you never saw it fail.

**One thing you may take off the implementation first: the contract.** Where the behaviour is written down nowhere else, read it once, [write the sentence down](#before-the-loop), and **then** delete the code.

## Where the rules live

| | Owns |
|---|---|
| The project's `AGENTS.md` | That this project is TDD-first |
| The project's `docs/testing.md` | **How tests are designed**: choosing a boundary, covering the behaviour space, equivalence classes, mocks and fixtures, what must not be written, how to run them — **and TDD's two exceptions** |
| This skill | **The loop**: what counts as red, what counts as green, how much one round covers |

**Read `docs/testing.md` before writing, changing or deleting any test.** Its applicability gate decides which cases this contract owes — do not infer that, or the exceptions, from principles. **Where the project has one, it is the only authority**: do not top it up from the template, including on sections it deliberately left out.

**With no `docs/testing.md`, read [`../init/templates/docs/testing.md`](../init/templates/docs/testing.md)** — the template `init` lands as that document — but **do not write it into the project**, and do not invent a standard of your own. Tell the user the document is missing and that `init` installs it. Two parts of the template are placeholders (`How to run them`, the shared-mocks bullet), so the real test command still comes from the repository.

## Before the loop

**Have one sentence you are making true.** "Given this precondition, doing this, you observe this." With an approved spec, take it from that spec's requirements and testing decisions — those seams were confirmed with the user. Under a plan, the task carries the sentence and names which requirement it serves. Otherwise write it yourself. **Not being able to write it means you do not yet know what you are building.**

**A bug needs a stable reproduction first**, from `systematic-debugging` — what it hands back is exactly this loop's RED.

**Pick the boundary before the first assertion**, per `docs/testing.md`'s boundary table: the narrowest one that can still observe the real contract. Do not pin private functions, DOM structure or call counts unless those are the contract; equally, do not push logic a unit test could observe into a heavily mocked test.

## The loop

Repeat for one minimal slice of behaviour. **The whole round travels together** — GREEN needs the specific failure output RED produced, so it is never split across two contexts or two dispatches.

### 1. RED — write the test

Only enough test to express the missing behaviour.

**The floor for one slice is one happy path plus one edge or failure case the contract genuinely owns** — empty input, exactly at the limit, either side of a threshold, a dependency erroring, permission denied. Where the contract has no edge and no failure path, write the happy path and stop rather than manufacturing a second case down the same branch.

### 2. Verify RED — mandatory, never skipped

Run it. Confirm it fails, **and that it fails because the target behaviour is missing**. Four failures that are not red:

- the environment or a dependency will not install
- a syntax or import error
- a wrong fixture or wrong test setup
- **it was already failing on the baseline before you touched anything**

Fix the cause and re-run until it fails for the right reason. **The test passed instead?** Then either this round adds nothing, or the assertion is too loose to tell the difference.

**Read the failure, do not just note its colour**: "it failed at this assertion, expected X, got Y" is the observation.

### 3. GREEN — the minimum implementation

The smallest amount of production code that makes that test pass. No capabilities that have no test yet, no refactoring of neighbouring code in this step.

### 4. Verify GREEN — mandatory

Run the target test, then the affected suites.

When something else is red, classify it before touching anything: a **regression** you just caused (fix it now), a **baseline failure** that was red before you arrived (note it, do not adopt it), or an **environment problem**. **Do not edit a test to accommodate the implementation** — unless the contract itself genuinely changed, and then say so out loud and record why.

### 5. REFACTOR — while green

Duplication, names, boundaries. Re-run after each small step. No new behaviour here.

---

**Every verification owes a command, an exit code and what you observed.** Nothing has to be filed anywhere, but if you cannot say which command you ran and what it printed, you did not run it.

## The two exceptions

Both live in `docs/testing.md`, and **neither is a blanket rule by file or task category**:

- **Genuinely behaviour-preserving work** — a refactor, a type cleanup, deleting dead code, a mechanical rename, a dependency bump confirmed not to change behaviour. **Verify** it rather than **testing** it.
- **Automation genuinely not feasible** — purely visual or motion adjustments, a fault reproducible only on one platform or lifecycle stage, copy changes. Verify by hand and keep the record; do not commit a pass-through test to satisfy a rule.

"This one is special" is not on the list.

## Red Flags

| Thought | Reality |
|---|---|
| "This code is obvious, write it and add tests after" | Green on the first run proves nothing. You never saw it fail. |
| "I already tested it by hand" | No record of what it covered, cannot be re-run, first thing dropped under pressure. |
| "Two hours in, deleting it is wasteful" | Sunk cost: those hours are spent either way. |
| "The test failed, so RED is done" | Only a failure caused by the missing behaviour counts — not environment, syntax, fixture or baseline. |

## Before you call it done

- [ ] Every new behaviour has a test, and you watched each one fail for the missing behaviour
- [ ] Each contract got a happy path plus the edge or failure case it owns, or it is stated that it has none
- [ ] The production code is the minimum that turns those tests green
- [ ] Target tests and affected suites both run, anything red classified as regression, baseline or environment
- [ ] Assertions are on observable outcomes, not private structure or call counts — unless the call is the contract
- [ ] Every verification can name its command, its exit code and what you observed
- [ ] A bug fix's regression test goes red when the old implementation is put back

**Cannot tick them all? Then this was not TDD** — go back to the box that failed rather than reporting it done.

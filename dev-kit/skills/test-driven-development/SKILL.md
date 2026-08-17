---
name: test-driven-development
description: >-
  Use when implementing new behaviour, fixing a reproducible bug or changing a public contract — before any production code is written, and the moment you catch yourself about to test code that already exists. Not for: syncing tests to an already-approved external change.
---

# Test-driven development (TDD)

```text
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

If implementation was written first, preserve its stated contract, delete it, and start from RED.

Read `docs/testing.md` before changing tests; it owns boundaries, coverage, mocks, fixtures and exceptions. If absent, consult [`../init/templates/docs/testing.md`](../init/templates/docs/testing.md), derive commands from the repository and report the missing guide without copying it.

## Before the loop

State the observable precondition, action and result from the approved spec/task; if impossible, stop and clarify.

A bug requires a stable reproduction and root cause from `systematic-debugging`; that reproduction becomes RED.

Choose the narrowest boundary that observes the real contract without exposing internals or replacing an available real seam with heavy mocks.

## The loop

1. **RED:** write only the test needed for the missing behaviour, including the edge/failure branch the contract genuinely owns.
2. **Verify RED:** require failure because behaviour is missing, not because syntax, imports, fixtures, environment or baseline failed. Record command, exit code and deciding output. A passing test proves no new behaviour.
3. **GREEN:** write the minimum production change that passes. Add no untested capability or adjacent refactor.
4. **Verify GREEN:** run target and affected suites. Classify failures as regression, baseline or environment before changing code; never weaken a valid test to match implementation.
5. **REFACTOR:** improve structure while green, rerunning after each step without adding behaviour.

Repeat for the next minimal slice.

## Exceptions

Use an exception only when `docs/testing.md` confirms it:

- genuinely behaviour-preserving work: run proportionate verification instead of inventing a new test;
- automation genuinely infeasible: verify manually and preserve runtime evidence instead of committing a pass-through test.

Return RED/GREEN commands, exit codes and observations; for bugs, also rerun the original reproduction.

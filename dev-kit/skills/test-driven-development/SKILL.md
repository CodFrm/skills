---
name: test-driven-development
description: >-
  Use when implementing new behaviour, fixing a reproducible bug or changing a public contract — before any production code is written, and the moment you catch yourself about to test code that already exists. Not for: syncing tests to an already-approved external change.
---

# Test-driven development (TDD)

```text
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

This loop runs inside a plan task, a short-route slice or a direct settled change. If implementation was written first, preserve only the stated contract, delete the implementation, and start from RED.

Read the project's `docs/testing.md` before changing tests. It owns boundary selection, behaviour-space coverage, mocks/fixtures and the two exceptions. If absent, read [`../init/templates/docs/testing.md`](../init/templates/docs/testing.md) without copying it into the project; get real commands from the repository and report that `init` can install the missing guide.

## Before the loop

State one observable sentence: given a precondition, an action produces a result. Use the approved spec/task sentence when present. If no sentence can be written, stop and clarify the behaviour.

A bug requires a stable reproduction and root cause from `systematic-debugging`; that reproduction becomes RED.

Choose the narrowest boundary that observes the real contract. Do not expose internals or use a heavily mocked boundary when a lower real seam can observe the behaviour.

## The loop

Keep one slice in one context.

1. **RED:** write only the test needed for the missing behaviour, including the edge/failure branch the contract genuinely owns.
2. **Verify RED:** run it. Require failure because the behaviour is missing, not syntax, import, fixture, environment or baseline failure. Record command, exit code and deciding assertion output. If it passes, the assertion does not prove a new behaviour.
3. **GREEN:** write the minimum production change that passes. Add no untested capability or adjacent refactor.
4. **Verify GREEN:** run the target and affected suites. Classify any red as regression, baseline failure or environment before changing anything. Do not weaken a valid test to match implementation.
5. **REFACTOR:** improve names, duplication and boundaries while green; rerun after each step. Add no behaviour.

Repeat for the next minimal slice.

## Exceptions

Use an exception only when `docs/testing.md` confirms it:

- genuinely behaviour-preserving work: run proportionate verification instead of inventing a new test;
- automation genuinely infeasible: verify manually and preserve runtime evidence instead of committing a pass-through test.

Before returning, report every RED/GREEN verification as command, exit code and observation. A bug fix must also rerun the original reproduction.

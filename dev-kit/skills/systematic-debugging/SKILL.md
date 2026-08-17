---
name: systematic-debugging
description: >-
  Use on a bug, a test failure, a build error, a performance regression, an intermittent or flaky fault, or behaviour that does not match the spec — before proposing or implementing a fix. Not for: a requirement that changed rather than broke.
---

# Systematic debugging

```text
NO FIX WITHOUT A REPRODUCTION AND A ROOT CAUSE
```

Run before TDD for any fault. Diagnosis is read-only; state the exact effect and obtain authorization before changing external systems, shared data or devices, sending side-effecting traffic or incurring material cost.

## The process

1. **Define:** record promised behaviour, expected, actual, environment, version, frequency and minimal trigger; read the complete error and stack trace.
2. **Reproduce:** prefer a minimal automated command; record exit code, timing and deciding output. For intermittent faults, record failure rate and differing conditions. Stop if stable evidence cannot be established.
3. **Attribute:** identify branch/HEAD, dirty tree, dependency/service versions and baseline failures; assign the observation to PR head, local changes or environment.
4. **Narrow:** trace input → transform → persist → output to find the last correct and first incorrect observation; inspect every component boundary before assigning blame.
5. **Compare:** enumerate differences from a working sibling path, passing test, earlier commit or complete reference.
6. **Test one hypothesis:** predict observations for true and false outcomes, then change one variable.
7. **Establish root cause:** explain why the mechanism fails only under the observed condition; correlation is insufficient.
8. **Hand to TDD:** turn the reproduction into RED, implement the minimum fix, remove instrumentation, and rerun the regression test and original reproduction.
9. **Report:** return command, exit code and observation for each decisive step. For cross-session or unresolved investigations, store redacted facts, inferences, unknowns, hypotheses, experiments and logs under `.dev-kit/artifacts/<spec-slug>/diagnostics/`.

## Disproving hypotheses with subagents

Each hypothesis may be one bounded subagent task returning predicted versus observed and eliminated versus standing. Dispatch serially, including read-only experiments; an inconclusive return is not re-dispatched.

The main session owns reproduction, attempt count and root-cause decision.

## The three-failure rule

After three consecutive attempts that do not materially change evidence, stop. Reassess the definition, reproduction, test seam and architecture; report what each ruled out. If the promised behaviour or design may be wrong, return to `brainstorming` with the evidence.

For an environmental, timing-dependent or external cause, state unobserved boundaries and why. Use TDD for any retry, timeout, error, degradation or observability change; never label an incomplete investigation “no root cause.”

---
name: systematic-debugging
description: >-
  Use on a bug, a test failure, a build error, a performance regression, an intermittent or flaky fault, or behaviour that does not match the spec — before proposing or implementing a fix. Not for: a requirement that changed rather than broke.
---

# Systematic debugging

```text
NO FIX WITHOUT A REPRODUCTION AND A ROOT CAUSE
```

This process runs before TDD wherever a fault appears. Diagnostic work is read-only by default. Before any experiment that mutates an external system, production/shared data, device state, sends traffic with side effects or incurs material cost, state the exact effect and obtain user authorization.

## The process

1. **Define the deviation:** record promised/spec behaviour, expected, actual, environment, version, frequency and minimal trigger. Read the entire error/stack trace.
2. **Establish reproduction:** prefer a minimal automated command. Record exit code, timing and deciding output. For intermittent faults, record failure rate and differing conditions. Stop if no stable evidence can be established.
3. **Attribute the evidence:** identify branch/HEAD, dirty tree, dependency/service versions and baseline failures. State whether the observation belongs to PR head, local changes or external environment.
4. **Narrow boundaries:** trace input → transform → persist → output; find the last correct and first incorrect observation. In multi-component flows, inspect each boundary before choosing a component.
5. **Compare a working case:** enumerate differences against a sibling path, passing test, earlier commit or complete reference implementation.
6. **Test one hypothesis:** write predicted observation for both true and false outcomes; change one variable.
7. **Establish root cause:** explain why the mechanism fails under this condition and not the working one. A correlation is not enough.
8. **Hand to TDD:** convert the reproduction into RED, implement the minimum fix, remove temporary instrumentation, then rerun both regression test and original reproduction.
9. **Report evidence:** command, exit code and observation for each decisive step. If the investigation spans sessions or ends without root cause, store redacted hypotheses, experiments and logs under `.dev-kit/artifacts/<spec-slug>/diagnostics/`, separating fact, inference and unknown.

## Disproving hypotheses with subagents

Each hypothesis may be a bounded subagent task returning predicted vs observed and eliminated vs standing. Dispatch serially, including read-only experiments.

The main session owns the reproduction, global attempt count and root-cause decision.

## The three-failure rule

After three consecutive experiments/attempts that do not materially change the evidence, stop patching. Reassess the problem definition, reproduction, test seam and architecture. Report what each attempt ruled out; if the promised behaviour or design may be wrong, return to `brainstorming` with that evidence.

When evidence establishes an environmental, timing-dependent or external cause, state the uninstrumented boundaries and why they could not be observed. Then use TDD to add the appropriate retry, timeout, clear error, degradation and/or observability; do not call an incomplete investigation “no root cause.”

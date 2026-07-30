---
name: systematic-debugging
description: >-
  Use on a bug, a test failure, a build error, a performance regression, an intermittent or flaky fault, or behaviour that does not match the spec — before proposing or implementing a fix. Not for: a requirement that changed rather than broke.
---

# Systematic debugging

**This is not a stage of the chain — it runs ahead of a fix, wherever the fault surfaced**: a task under [`executing-plans`](../executing-plans/SKILL.md#the-loop), a bug report with no round around it, or a spec requirement that does not hold. It ends by handing [`test-driven-development`](../test-driven-development/SKILL.md) a reproduction, which becomes that round's RED.

## The Iron Law

```
NO FIX WITHOUT A REPRODUCTION AND A ROOT CAUSE
```

The guess that appears to work is indistinguishable from the one that actually fixed it, so the bug ends up hidden rather than gone. "It went away when I changed it" is not a root cause. Neither is a correlation, nor a fix whose mechanism you cannot explain.

**Do not change production code before you have a reproduction and root-cause evidence.** The diagnostic phase is read-only by default.

Anything that would write to an external system, production data or device state — or an expensive load test — **needs the user's authorisation first**, stated as what you are about to run and what it touches. This is the one place in this kit where "ask, do not decide" beats the three gates: the cost lands where `git revert` cannot reach.

## The process

**1. Define the deviation.** Quote the spec sentence this contradicts, or the acceptance sentence this round set itself, or the currently promised behaviour. Then write down: expected, actual, environment, version, frequency, minimal trigger. Read the error message and stack trace to the end first — they frequently contain the answer.

**2. Establish a reproduction.** Prefer an automated, minimal one; record the command, its exit code and its timing. Where it cannot be reproduced stably, collect several samples rather than pretending to determinism — how often out of how many runs, and what differs between the runs that fail and those that do not. **No reproduction, no further steps**: everything below takes it as the shared premise.

**3. Confirm the baseline and attribution.** Check the target branch, the working tree, dependency and service versions, and the failures that were already there. Then say which of these the evidence belongs to: the PR head, the dirty working tree you are standing in, or the external environment.

**4. Narrow along the boundary.** Find the last point where the value is still correct and the first point where it is not, along input → transform → persist → output. Prefer temporary, reversible observation over scattering changes through the code.

In a multi-component system — CI → build → sign, API → service → database, extension → host → runtime — instrument the boundaries before forming any hypothesis about which component is at fault, recording at each what goes in, what comes out, and whether environment and config propagated. Then trace backwards to the origin: where the bad value first comes into existence, and what called that with what. **Fix it there, not where it surfaced** — a fix at the symptom leaves every other caller broken.

**5. Compare against something that works.** The sibling route that returns correctly, the neighbouring test that passes, the earlier commit — and list *every* difference, however small. "That cannot matter" is a hypothesis, not an observation. Where the code is meant to follow a reference implementation, read the reference completely before adapting it.

**6. One hypothesis at a time.** Order them by evidence. Before each experiment write down: **if H holds I should see X; if it does not I should see Y.** A hypothesis with no observation that could refute it is not testable. Change one variable per experiment — two at once and neither result is attributable.

**7. Establish the root cause.** Explain the mechanism: why it triggers under exactly this condition and not others, and why the similar paths that are fine are fine. **If you cannot say why it only happens under that condition, you have a correlation.**

**8. Hand the fix to TDD.** Turn the minimal reproduction into a failing regression test first, then go through `test-driven-development`. Afterwards remove the temporary observation from step 4 and **re-run the original reproduction**, not just the new test: the regression test proves your mechanism is fixed, the reproduction proves the reported problem is gone.

**9. Say what you found.** Every step owes a command, an exit code and what you observed; nothing has to be filed by default. Write it down when the investigation outgrows one session — several rounds of experiments, a hand-off, or an investigation ending without a root cause. Then `.dev-kit/artifacts/<spec-slug>/diagnostics/` gets the experiment table, the hypotheses you eliminated and how, and redacted logs, distinguishing fact, inference and unknown.

## Disproving hypotheses in parallel

Step 6's list suits dispatch: one subagent per hypothesis, each running its own disproving experiment, reporting "what I expected / what I saw / eliminated or still standing". Run serially, the previous conclusion contaminates the next one's evidence.

Four boundaries:

- The reproduction is established first, and in the main session — it is the shared premise of every experiment.
- **Only read-only experiments run in parallel.** Experiments that change production code are serial: with two subagents changing one working tree, neither one's evidence stands.
- The three-failure rule counts globally — three subagents each trying once is three failures, not one each.
- The root cause is settled by the main session, which is the only one holding every report.

## The three-failure rule

**When three consecutive attempts have not changed the evidence, stop patching.** The fourth is drawn from the same understanding that produced the first three. The shape of the failures names what is actually wrong:

| What the three attempts looked like | What it means |
|---|---|
| Each fix reveals new shared state or coupling elsewhere | The architecture, not the bug |
| Each fix would need "a big refactor" to do properly | Same — the design is fighting you, and that is the finding |
| Each fix creates a new symptom elsewhere | You are at a symptom, not the source. Back to step 4 |
| The evidence never moved at all | The problem definition or the reproduction is wrong. Back to step 1 |

Then re-examine the problem definition, the test seam and the architectural assumptions; where necessary go back to the spec and put it to the user that the goal itself may be wrong, bringing what each attempt ruled out. **Three failed attempts is a finding to report, not an open question to hand over.**

## When the investigation says there is no root cause

Sometimes the answer really is environmental, timing-dependent or external. Then: say what you investigated and what it ruled out, implement the appropriate handling (retry, timeout, a clear error, degradation), and add the observability that makes the next occurrence diagnosable.

**Hold that verdict to a high bar.** Most "there is no root cause" is an investigation that stopped at the first boundary it could not see past. Before writing it down, name which boundary you did not instrument and why.

## Red Flags

| Thought | Reality |
|---|---|
| "It looks like it is here, change it and see" | A change with no prediction attached teaches you nothing when it works. |
| "It went away, so that was the cause" | A correlation. State the mechanism, or keep going. |
| "It is an emergency, there is no time for this" | Guess-and-check thrashing only feels like progress because something is always happening. |
| "I re-ran it and it passed, so it is fixed" | For an intermittent fault, one green run is one sample. |

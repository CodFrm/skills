---
name: systematic-debugging
description: >-
  Use on a bug, a test failure, a build error, a performance regression, an intermittent or flaky fault, or behaviour that does not match the spec — before proposing or implementing a fix. Not for: a requirement that changed rather than broke, a feature request with no fault behind it, or a well-evidenced diagnosis the user only wants explained.
---

# Systematic debugging

## The Iron Law

```
NO FIX WITHOUT A REPRODUCTION AND A ROOT CAUSE
```

"It looks like it is here, change it and see" is not debugging — it is a guess with a build step. Guesses are expensive in a specific way: the one that appears to work is indistinguishable from the one that actually fixed it, so the bug is now hidden rather than gone, and you have taught yourself the wrong thing about the system.

**"It went away when I changed it" is not a root cause.** Neither is a correlation, nor a fix you cannot explain the mechanism of.

## Hard rules

**Do not change production code before you have a reproduction and root-cause evidence.** The diagnostic phase is **read-only by default**.

Anything that would write to an external system, production data or device state — or an expensive load test — **needs the user's authorisation first**, stated as what you are about to run and what it touches. This is the one place in this kit where "ask, do not decide" beats the three gates: the cost lands outside the repository, where a `git revert` cannot reach it.

## The process

### 1. Define the deviation

**Quote the spec sentence this contradicts** — or the acceptance sentence this round set for itself, where there is one — or state the currently promised behaviour explicitly. Then write down: expected, actual, environment, version, frequency, and the minimal trigger condition.

**Read the error message and the stack trace to the end first.** They frequently contain the answer — a line number, a path, an error code — and skipping past them to a hypothesis is the single most common way to spend an hour on something the first screen already said.

### 2. Establish a reproduction

Prefer an automated, minimal one. Record the full command, its exit code and its timing.

**When it cannot be reproduced stably, collect several samples rather than pretending to determinism** — how often out of how many runs, and what differs between the runs that fail and the runs that do not. An intermittent fault with one observation behind it has not been reproduced; it has been seen.

**No reproduction, no further steps.** Everything below takes it as the shared premise.

### 3. Confirm the baseline and attribution

Check the target branch, the working tree, the dependency and service versions, and the failures that were already there. Then be explicit about **which of these the evidence belongs to**: the PR head, the dirty working tree you are standing in, or the external environment. Evidence attributed to the wrong one of those sends the whole investigation into a subsystem that was never involved.

### 4. Narrow along the boundary

Find **the last point where the value is still correct and the first point where it is not**, along the input → transform → persist → output chain. Prefer adding temporary, reversible observation over scattering changes through the code.

**In a multi-component system — CI → build → sign, API → service → database, extension → host → runtime — instrument the boundaries before forming any hypothesis about which component is at fault.** At each boundary record what goes in, what comes out, and whether the environment and config propagated. Run it once, and read off which hop broke rather than guessing which component to open first. One run of boundary logging routinely replaces three rounds of opening the wrong file.

**Then trace backwards to the origin.** Where does the bad value first come into existence, and what called that with what? Keep walking up until you reach the source — and **fix it there, not where it surfaced.** A fix at the symptom leaves every other caller of the same source still broken.

### 5. Compare against something that works

**Find the nearest thing in this codebase that does work** — the sibling route that returns correctly, the neighbouring test that passes, the earlier commit — and list **every** difference against the broken one, however small. "That cannot matter" is a hypothesis, not an observation, and it is wrong often enough to be worth writing down instead of skipping.

Where the broken code is meant to follow a reference implementation or a documented pattern, **read the reference completely before adapting it**. Partial reading is how you reproduce the shape of a pattern without the constraint that made it work.

### 6. One hypothesis at a time

Order the hypotheses by evidence. Before each experiment, **write down: if H holds I should see X; if it does not I should see Y.** A hypothesis with no observation that could refute it is not testable, and running the experiment will teach you nothing either way.

Change **one variable per experiment**. Two changes at once means neither result is attributable.

### 7. Establish the root cause

Explain the causal mechanism: why it triggers under exactly this condition and not others, and why the similar paths that are fine are fine. **If you cannot say why it only happens under that condition, you have found a correlation, not a cause** — and the fix will hold right up until the condition shifts.

### 8. Hand the fix to TDD

**Turn the minimal reproduction into a failing regression test first**, then go through `test-driven-development` for the fix itself — the reproduction is exactly the RED that skill needs, and it is already proven to fail for the right reason, which is the part that is usually hard.

Afterwards: remove the temporary observation you added in step 4, and **re-run the original reproduction** — not just the new test. The regression test proves the mechanism you found is fixed; the original reproduction proves the thing the user reported is gone, and they are not always the same statement.

### 9. Say what you found

**Every step above owes a command, an exit code and what you observed** — the same bar as everywhere else in this kit. Nothing has to be filed by default.

**Write it down when the investigation outgrows one session**: several rounds of experiments, a hand-off, or an investigation that ends without a root cause. Then `.dev-kit/artifacts/<spec-slug>/diagnostics/` gets the experiment table, the hypotheses **you eliminated and how**, and redacted logs — distinguishing fact, inference and unknown. The eliminated hypotheses are the valuable part: without them the next session starts by ruling out what you already ruled out, which is the most expensive way there is to make no progress.

## Disproving hypotheses in parallel

Step 6's hypothesis list suits subagent dispatch: **one subagent per hypothesis, each running its own disproving experiment**, reporting back "what I expected to see / what I actually saw / eliminated or still standing". Run serially, the previous conclusion contaminates the next one's evidence gathering; only in parallel do you get genuinely independent evidence. And diagnostic output is voluminous while the conclusion is one line — exactly the shape that should be dispatched.

**Four boundaries. Cross them and parallelism turns into mutual contamination:**

- **The reproduction is established first, and in the main session.** It is the shared premise of every experiment; parallel runs without it return several mutually incomparable observations.
- **Only read-only experiments run in parallel.** Adding temporary observation, reading logs, querying data, running existing tests — fine. **Experiments that change production code are serial**: with two subagents changing the working tree at once, neither one's evidence stands. (Unless each genuinely has its own working tree.)
- **The three-failure rule counts globally.** Three subagents each trying once and changing nothing is three failures, not one each.
- **The root cause is settled by the main session.** What was eliminated, what remains and what the mechanism is can only be judged with every report in view. A subagent only ever sees its own.

## The three-failure rule

**When three consecutive attempts have not changed the evidence, stop patching.** Not "try a fourth, this one looks right" — the fourth is drawn from the same understanding that produced the first three.

Look at the shape of the failures, because it names what is actually wrong:

| What the three attempts looked like | What it means |
|---|---|
| Each fix reveals new shared state or coupling somewhere else | The architecture, not the bug. Say so rather than fixing a fourth symptom |
| Each fix would need "a big refactor" to do properly | Same — the design is fighting you, and that is the finding |
| Each fix creates a new symptom elsewhere | You are at a symptom, not the source. Go back to step 4 and trace further up |
| The evidence never moved at all | The problem definition or the reproduction is wrong. Back to step 1 |

Then re-examine the problem definition, the test seam and the architectural assumptions; where necessary go back to the spec and **put it to the user that the goal itself may be wrong**, bringing what you tried, what each attempt ruled out, and which reading of the requirement you would now take.

**Three failed attempts is a finding to report, not an open question to hand over.**

## When the investigation says there is no root cause

Sometimes the answer really is environmental, timing-dependent or external. Then: say what you investigated and what it ruled out, implement the appropriate handling (retry, timeout, a clear error, degradation), and add the observability that would make the next occurrence diagnosable.

**But hold that verdict to a high bar.** Most "there is no root cause" is an investigation that stopped at the first component boundary it could not see past. Before you write it down, name which boundary you did not instrument and why.

## Common rationalisations

| Excuse | Reality |
|---|---|
| "This one is simple, the process is overkill" | Simple bugs have root causes too, and the process is correspondingly short on them. What is expensive is the guess that appeared to work. |
| "It is an emergency, there is no time for this" | Systematic is faster than guess-and-check thrashing — the thrashing just feels like progress because something is always happening. |
| "Let me try this one thing first, then investigate properly" | The first attempt sets the pattern, and "then investigate properly" is not what happens after it appears to work. |
| "I will write the regression test once I have confirmed the fix" | Then you never watch it fail, and an untested fix is one refactor away from silently coming back. The reproduction is already your failing test — use it. |
| "Fix several things at once, it saves a round trip" | Then no result is attributable and you have possibly added a second bug while removing the first. |
| "The reference implementation is long, I will adapt the pattern" | Partial reading reproduces the shape of the pattern without the constraint that made it work. |
| "More logging will make it easier to find" | Logging without a bounded problem is noise you now have to read, and it leaks sensitive data at the worst possible moment. |
| "It is a third-party failure, not ours" | Maybe — after you have shown the failure boundary, what the retry and degradation contract promises, and what the user actually sees. |
| "I re-ran it and it passed, so it is fixed" | For an intermittent fault, one green run is one sample. State the stability criterion and meet it. |
| "One more fix attempt" (after three) | Three failures is a finding about the design, not a reason to draw a fourth guess from the same understanding. |

## Red Flags

| Thought | Reality |
|---|---|
| "It looks like it is here, change it and see" | Write the falsifiable hypothesis and the expected observation first. A change with no prediction attached teaches you nothing when it works. |
| "It went away, so that was the cause" | That is a correlation. State the mechanism and why it only triggers under that condition, or keep going. |
| "The stack trace is long, the gist is obvious" | The line you skipped is where the answer usually is. |
| "Which component is broken? Probably the one I know best" | Instrument the boundaries and read it off. One run of boundary logging beats three rounds of opening the wrong file. |
| "Fix it where the error surfaced" | That leaves every other caller of the same source broken. Trace up to where the bad value is born. |
| "Refactor the whole block while I am fixing it" | Isolate the fix with a minimal regression test first. Refactor once it is green — that is `test-driven-development`'s last step, not this one's. |
| "The new test passes, done" | Re-run the original reproduction too. The regression test proves your mechanism is fixed; only the reproduction proves the reported problem is gone. |
| "Dispatch several hypotheses and let each change code to test" | Simultaneous working-tree changes mean nobody's evidence stands. Read-only experiments run in parallel; code changes are serial. |
| "The subagent says its hypothesis holds, so that is the root cause" | It only ever saw its own. A root cause needs every report in view. |
| "I will just run this migration to see what happens" | An experiment that writes to an external system, production data or device state needs the user's word first. `git revert` does not reach outside the repository. |

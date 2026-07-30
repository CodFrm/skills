# When to ask the user, and how

Shared across skills. `brainstorming`'s questions and approval gate, and `init`'s step-2 sign-off items, all follow the rules here.

> **The three-gate table below is deliberately copied twice, and this note is the register of every copy.** [`using-dev-kit/SKILL.md`](../SKILL.md#when-to-ask-the-user-look-it-up-decide-it-and-only-then-ask) carries one because a SessionStart hook injects that file into every session, so the gates are in context before the first question is asked rather than one file away. [`init/SKILL.md`](../../init/SKILL.md#b-questions-you-need-answered) carries one so that `init` can be dropped into a project **without the rest of this kit**. **Same rule, three places — change one and change all three.** This file is the fuller treatment; the other two are operating summaries, and each has to carry gate 2's test on its own.

## Two pillars

**One: the user's attention is the most expensive resource you have.** The more you ask, the less each question weighs — eventually the user starts answering "whatever" off the cuff, and by then the confirmation you got is worthless, while the one question that genuinely needed them is buried in the pile.

**Two: asking less is not the same as guessing more. Every call you make yourself has to come with evidence.** Swapping "ask the user" for "just pick one" only moves the cost from their attention to the rework — and during that rework nobody knows why it was decided that way. **A decision without evidence is not a decision, it is a guess.** A guess either goes back to be looked up, or gets escalated into a question.

Both pillars, together. The first alone turns into making things up; the second alone turns into asking about everything.

## Three tiers: findable / cheap-if-wrong / rework-if-wrong

Take the open item through these three gates in order and **stop at the first one that holds**:

| # | Criterion | Action | Evidence you must keep |
|---|---|---|---|
| 1 | **Findable in the repo or the environment** | Look it up, then just use it. Do not ask | The command and its output, or `file:line` |
| 2 | Not findable, but **cheap to change if wrong** | Decide it yourself, **say in one line what you decided and on what basis**, and carry on | The basis (even if it is only "the ecosystem default is X and this project holds no evidence to the contrary") plus a landing spot: the spec's design decisions |
| 3 | Not findable, and **wrong means rework or an irreversible cost** | Only now do you ask, using the four-part form below | The user's own words |

**Gate 1 is the one that gets skipped wholesale.** "When in doubt, ask, do not guess" sounds safe, but it swallows the act of *looking it up* — the base branch is computable with `git merge-base`, whether CI exists is visible with `ls .github/workflows`, what the project does is written in the README. **Asking a question you could have answered yourself trades the user's time for your thirty seconds.**

Gate 2's criterion is the same one as `brainstorming`'s table: **does this decision change behaviour the user can observe?** If yes, gate 3. If no, decide it yourself.

## What counts as evidence

Gates 1 and 2 both demand evidence, but the form differs by the kind of decision. Do not let one stand in for another:

| Kind of decision | What counts | What does not |
|---|---|---|
| State of the world (which command, which base branch, whether CI exists) | The command plus its output, or `file:line` | "It is usually main" |
| Scale (how many existing violations, whether a ratchet is needed) | A number (the result of `git grep -c`) | "Some", "quite a few" |
| Selection (which library, how to layer) | An existing precedent in the project at `file:line`; with no precedent, "the ecosystem default is X and this project holds no evidence to the contrary" | A bare "I think X is better" |
| Requirements (what to build, where the boundary is) | The user's own words, or a line in an approved spec | Intent reverse-engineered from the code |
| External material (what a library, tool, spec or RFC actually says or does) | The material itself, opened — identified precisely enough that the next session can open the same thing: a version, a path, a URL, a git ref | Recollection; the ecosystem-default sentence stretched from a preference into a claim about what the material says or does |

**"Experience" can serve as evidence, but only once written as a refutable sentence.** "The ecosystem default is X and this project holds no evidence to the contrary" is something the next session can re-check and overturn. "I think" is not.

**When the material cannot be reached, say so plainly and mark the claim as unverified recollection — not a quiet promotion to fact.** A dangling reference (a symlink into a directory that does not exist, a fetch that errors, a version you cannot pin) gets reported the same way a missing prerequisite does; its absence does not get to pass as silence.

## When you do ask: four parts

Missing any one of these means the question is not ready:

1. **A list of options** — 2 to 4, mutually exclusive, each stating what happens if picked.
2. **Your recommendation, first and marked as such** — you hold more evidence than the user does: you just scanned this repo, you just ran these tests.
3. **The basis for that recommendation** — not "I think", but "scanned X / got Y / the project already has Z".
4. **What happens if they do not answer** — state the default where there is one; where you are genuinely stuck, say which step is stuck.

Compare:

> ❌ "Should we add i18n guardrails?"
> ✅ "`git grep -l i18next` returns nothing — no i18n library anywhere; but the commit history has 5 i18n-related fixes, which looks like it was planned and never landed. **My recommendation is to skip i18n guardrails this round** and add them when it is actually wired in. No reply and I proceed on 'skip'."

The difference is not politeness, it is that **the second one moves without an answer**. The first stalls; the second treats silence as consent.

**Ceiling: 3 to 5 per round, 7 at the very most.** Going over means you are reciting a generic checklist rather than asking about this project.

**Every question must come with "this answer changes what I do, specifically".** If you cannot say what changes, do not ask — that is curiosity, not a sign-off item.

**Batch them into one round.** Interrupting one question at a time halfway through shatters the user's time and your progress at once. `brainstorming`'s exploration is the deliberate exception: there the questions interact, so they go one at a time and each one's answer reshapes the next.

## Which gates this rule does not get to remove

What these approve is **what to build, not how to build it**, and being wrong means the whole thing is redone:

| Gate | Why it stays |
|---|---|
| The user's approval of the spec (`brainstorming`) | The requirement itself. A wrong spec means all the code that follows correctly implements the wrong thing |
| Sign-off on `init`'s step-2 recommendation list | How many guardrails get nailed into someone's project is the project owner's call |

Note the **shape** of both: not a multiple-choice question but "here is a finished document, veto what you disagree with". The user's action is to read it once and nod, not to do your design for you. Keep that shape — the moment it degrades into a string of open questions it is violating the rules above.

**Destructive actions are equally exempt**: before deleting a branch, discarding a workspace or overwriting existing content, list exactly what will be lost first.

## Red Flags

| Thought | Reality |
|---|---|
| "Might as well check this one with the user too, to be safe" | The more you ask, the less each question weighs — the payoff is a string of "whatever". |
| "Not sure, let me ask the user" | Take gate 1 first: is it findable in the repo or the environment? Asking a question you could answer yourself trades the user's time for your thirty seconds. |
| "Do not pick for them, hand the options over as they are" | Give the options *and* the recommendation. You just scanned this repo and just ran the tests on this tree — you hold more evidence than they do. Withholding it is not neutrality, it is pushing the judgement cost onto them. |
| "They never answered that one, I will just take the common default" | First work out which tier it was: tier 2 was always yours to decide (with the basis written down), tier 3 unanswered means still undecided. Do not pass a default off as a confirmation. |
| "Asking less is the goal, so I will just pick this one" | Picking is fine — where is the basis? What you cannot justify is not a decision but a guess. Go look it up, or escalate it to tier 3. |
| "The basis is my experience" | Experience qualifies, but only written as a refutable sentence: "the ecosystem default is X and this project holds no evidence to the contrary". A bare "I think" is not something the next session can re-check. |
| "Lots of questions, I will ask them as they come up" | Outside `brainstorming`'s exploration, batch them into one round — interrupting one at a time shatters the user's time and your progress together. |

# When to ask the user, and how

Shared across skills. `brainstorming`'s questions and approval gate, and `init`'s step-2 sign-off, all follow the rules here.

> **This file owns the three-gate rule, and this note is the register of everywhere else it appears.** The only full copy is in [`init/SKILL.md`](../../init/SKILL.md#b-questions-you-need-answered), so that `init` can be dropped into a project **without the rest of this kit** — **change the rule here and change that too.** Everywhere else links here rather than restating: [`using-dev-kit`](../SKILL.md#the-rule) with one line on gate 1, [`brainstorming`](../../brainstorming/SKILL.md#only-significant-decisions-go-to-the-user) with its observable-behaviour table, [`using-git-worktrees`](../../using-git-worktrees/SKILL.md#when-to-use--when-not-to) and [`executing-plans`](../../executing-plans/SKILL.md) at the points where each would otherwise ask.

## Two pillars

**One: the user's attention is the most expensive resource you have.** The more you ask, the less each question weighs — eventually they answer "whatever" off the cuff, and the one question that mattered is buried in the pile.

**Two: asking less is not the same as guessing more.** Swapping "ask the user" for "just pick one" moves the cost from their attention to the rework. **A decision without evidence is not a decision, it is a guess** — and a guess goes back to be looked up, or up to be asked.

Both together. The first alone turns into making things up; the second alone turns into asking about everything.

## Three tiers: findable / cheap-if-wrong / rework-if-wrong

Take the open item through these gates in order and **stop at the first that holds**:

| # | Criterion | Action | Evidence you keep |
|---|---|---|---|
| 1 | **Findable in the repo or the environment** | Look it up, then use it. Do not ask | The command and its output, or `file:line` |
| 2 | Not findable, but **cheap to change if wrong** | Decide it yourself, **say in one line what you decided and on what basis**, carry on | The basis — even if only "the ecosystem default is X and this project holds no evidence to the contrary" — plus a landing spot: the spec's design decisions |
| 3 | Not findable, and **wrong means rework or an irreversible cost** | Only now ask, in the four-part form below | The user's own words |

**Gate 1 is the one that gets skipped wholesale.** "When in doubt, ask, do not guess" sounds safe, but it swallows the act of *looking it up*: the base branch is `git merge-base`, whether CI exists is `ls .github/workflows`, what the project does is in the README. **Asking a question you could have answered yourself trades the user's time for your thirty seconds.**

Gate 2's criterion is the same as `brainstorming`'s table: **does this decision change behaviour the user can observe?** Yes → gate 3. No → decide it yourself.

## What counts as evidence

Gates 1 and 2 both demand it, but the form differs by the kind of decision — do not let one stand in for another:

| Kind of decision | What counts | What does not |
|---|---|---|
| State of the world (which command, which base branch, whether CI exists) | The command plus its output, or `file:line` | "It is usually main" |
| Scale (how many violations, whether a ratchet is needed) | A number (`git grep -c`) | "Some", "quite a few" |
| Selection (which library, how to layer) | A precedent in the project at `file:line`; with none, "the ecosystem default is X and this project holds no evidence to the contrary" | A bare "I think X is better" |
| Requirements (what to build, where the boundary is) | The user's own words, or a line in an approved spec | Intent reverse-engineered from the code |
| External material (what a library, tool, spec or RFC says or does) | The material itself, opened, identified precisely enough that the next session can open the same thing: a version, a path, a URL, a git ref | Recollection; the ecosystem-default sentence stretched into a claim about what the material does |

**"Experience" qualifies only once written as a refutable sentence.** "The ecosystem default is X and this project holds no evidence to the contrary" can be re-checked and overturned. "I think" cannot.

**Where the material cannot be reached, say so and mark the claim unverified** — a dangling reference, a fetch that errors, a version you cannot pin. Its absence does not get to pass as silence.

## When you do ask: four parts

Missing any one of them means the question is not ready:

1. **A list of options** — 2 to 4, mutually exclusive, each stating what happens if picked.
2. **Your recommendation, first and marked as such** — you hold more evidence than the user: you just scanned this repo, you just ran these tests.
3. **The basis for it** — not "I think", but "scanned X / got Y / the project already has Z".
4. **What happens if they do not answer** — the default where there is one; where you are genuinely stuck, which step is stuck.

> ❌ "Should we add i18n guardrails?"
> ✅ "`git grep -l i18next` returns nothing — no i18n library anywhere; but the commit history has 5 i18n-related fixes, which looks planned and never landed. **My recommendation is to skip i18n guardrails this round** and add them when it is actually wired in. No reply and I proceed on 'skip'."

The difference is not politeness: **the second one moves without an answer.**

**Ceiling: 3 to 5 per round, 7 at the very most.** Going over means you are reciting a generic checklist rather than asking about this project. **Every question comes with "this answer changes what I do, specifically"** — if you cannot say what changes, that is curiosity, not a sign-off item.

**Batch them into one round.** `brainstorming`'s exploration is the deliberate exception: there the questions interact, so each answer reshapes the next.

## Which gates this rule does not remove

| Gate | Why it stays |
|---|---|
| The user's approval of the spec (`brainstorming`) | The requirement itself. A wrong spec means all the code that follows correctly implements the wrong thing |
| Sign-off on `init`'s step-2 recommendation list | How many guardrails get nailed into someone's project is the project owner's call |

Note the **shape** of both: not a multiple-choice question but "here is a finished document, veto what you disagree with". The moment it degrades into a string of open questions it is breaking the rules above.

**Destructive actions are equally exempt**: before deleting a branch, discarding a workspace or overwriting existing content, list exactly what will be lost first.

## Red Flags

| Thought | Reality |
|---|---|
| "Not sure, let me ask the user" | Gate 1 first: is it findable? That trades their time for your thirty seconds. |
| "Might as well check this one too, to be safe" | The more you ask, the less each question weighs — the payoff is a string of "whatever". |
| "Asking less is the goal, so I will just pick this one" | Picking is fine — where is the basis? |
| "The basis is my experience" | Only once written as a refutable sentence the next session can overturn. |
| "Hand the options over bare; picking for them would be presumptuous" | You hold more evidence than they do. Withholding it is not neutrality. |
| "They never answered, I will take the common default" | Tier 2 was always yours to decide; tier 3 unanswered means still undecided. Do not pass a default off as a confirmation. |

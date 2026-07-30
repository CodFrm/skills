---
name: brainstorming
description: >-
  Use when adding a feature, changing behaviour or designing UI, when the requirements are still vague, and equally when the requirement is already clear and only needs writing down — before any implementation skill is reached for. Come back to it when an agreed requirement turns out to be wrong and the spec has to change. Not for: retrofitting a rationalising document onto an existing implementation, pure factual Q&A, read-only investigation, or one-off mechanical changes.
---

# Requirements exploration and specification (brainstorming)

## Hard gate

**Do not write production code, test code, migrations or scaffolding before the user has agreed the design.** The only writing allowed during exploration is `.dev-kit/artifacts/<spec-slug>/mockups/`, used with the user's consent to clarify the design.

This skill's end point is **an approved spec, committed** — not an implementation.

## Two gates, and they are not the same shape

There are two approvals in here and it matters that they stay distinct:

| | What is being approved | Its shape |
|---|---|---|
| **Design agreement** (during exploration) | The direction: scope, flows, failure behaviour, the option that won | Conversational, section by section. The user is thinking alongside you |
| **Spec approval** (after writing) | The written file | "Here is a finished document, veto what you disagree with." The user **reads the file** |

**The second one is not a formality that the first makes redundant.** Its whole value is that what gets read is the final text rather than a recollection of the conversation — a paragraph nobody objected to while talking often reads differently once it is written down as the thing you are going to build. If you find yourself thinking "we agreed all this already, so approval is automatic", that is the gate collapsing.

Between the two there is always the act of writing the file and sending its path.

## Order

1. **Read-only exploration.** Read the project docs, the relevant code, existing tests, recent related commits. **Run the suite once while you are here** — reading the tests says what they claim, running them says whether the project is currently green, and a spec cannot state what would count as a regression against a baseline nobody has looked at. A red baseline goes in the spec's problems as an observed fact, or is named as pre-existing and out of scope; either way it is not discovered later by whoever implements. Distinguish verified facts, user statements and speculation. **Fix the slug now** — `YYYY-MM-DD-<lowercase-short-name>`, taking today — because the mockup directory and every later evidence directory follow it.
2. **Decide whether the requirement needs splitting.** If it contains several independently shippable subsystems, give the split and the dependency order first, and carry on with only the first spec.
3. **Ask one question at a time.** Only about things that would change the scope, the interaction or how it is accepted. Prioritise purpose, primary users, success criteria, failure behaviour and compatibility boundaries; **do not ask what the repository can answer.**
4. **Give 2–3 options.** Recommendation first, stating user impact, implementation and maintenance cost, risks, and the capabilities given up. Delete extension points that no current requirement asks for.
5. **Present the design.** Walk through the user flow, boundaries, state and data flow, errors and recovery, and test seams, sectioned by complexity. **Get agreement on each section before continuing.**
6. **Write the spec** into `docs/specs/<spec-slug>.md`, per "Writing the spec" below. Do this **immediately** once the design is agreed — the conclusions live only in the conversation until then, a session break or a context compaction is enough to lose them, and a round of exploration is dozens of exchanges to redo.
7. **Self-check, then send the path to the user** and wait for explicit approval.
8. **Commit the approved spec** on the current branch, by path.

**A still-open question cannot be carried into the spec if it would change what the thing has to do.** Either settle it, or state explicitly which part it blocks — do not write TBD and move on.

## Only significant decisions go to the user

The user's attention is this skill's most expensive resource: **the more you ask, the less each question weighs**, and by the end the user is answering "whatever" off the cuff, at which point the agreement you obtained is worthless. The criterion is **whether the decision changes behaviour the user can observe**:

| Take to the user | Decide yourself |
|---|---|
| Scope and non-goals — what this round does and does not do | Which library, how the code is layered, how functions are split |
| Flows, interactions and copy the user can see | Internal data structures and naming |
| Behaviour on failure: error, retry, or degrade to what | Log format, internal error code values |
| Compatibility floors, privacy and permission boundaries | How the tests are organised |
| Anything you cannot judge where guessing wrong means rework | Anything cheap to change after guessing wrong |

**The ones you decide yourself still get recorded** — they go into the spec's numbered design decisions, stating what was chosen, what was rejected and why. **The reasoning is worth more than the conclusion**: when someone later wants to change it back, the reasoning is the only thing that will stop them. The only difference from the left column is that they do not need the user's nod to proceed.

**"Decide yourself" is not "guess".** Every entry in that column owes evidence: an existing precedent in the project at `file:line`, or — where there is none — a refutable sentence like "the ecosystem default is X and this project holds no evidence to the contrary". What you cannot justify is not a decision but a guess, and a guess goes back to being looked up or forward to being asked. **A rejected option's claim about what an external library, tool or spec actually does is evidence too, and it is checked the same way: open the thing, do not recall it.** The full tiering, what counts as evidence, and the form a question takes are in [asking-users.md](../using-dev-kit/references/asking-users.md).

## Which parts get a subagent

**Step 4's options are well suited to parallel dispatch: one subagent per option, each drafted independently** (user impact, implementation and maintenance cost, risks, what is given up). Written serially, the second option always ends up growing along the first one's frame without meaning to; only running them in parallel produces genuine alternatives. The same applies to step 1's exploration when the surface is wide — one module each, reporting back "conclusion + `file:line`". Several mockup variants likewise — one directory each, not overwriting one another.

**Comparing them side by side, ordering the recommendation and extracting the shared premises are the main session's job.** A subagent only sees its own version.

**Four things never get dispatched:** asking the user a question, waiting for agreement, deciding whether a requirement needs splitting into several specs, and **writing the spec itself**. A subagent cannot reach the user, so what it writes is guessed requirements — and a spec's entire value is that it was agreed. Fact-finding can be dispatched (does this seam exist, what does the contract look like now); writing it and taking it through the gate cannot.

## UI and HTML mockups

Three judgements; everything else is in [mockups.md](references/mockups.md).

- **When.** Only when a visual rendering clearly lowers the communication cost — layout, density, hierarchy or responsive behaviour genuinely undecided, rather than every UI change. When it does, **say you are going to build one and what it will settle, then build it**: the cost lands on you, not on them, so this is a heads-up rather than a question.
- **Use the project's real tokens and components** — read its `docs/design.md` first (the one `init` generates), or source the same facts from the token definition file and an existing well-built page. Otherwise the design the user nods at is one the codebase cannot build: the implementation hits that document's Core Constraints and the colour-token lint, and you go back to the user having already spent their nod. A value the design system has no name for is worth **proposing as a new token in the spec**, not quietly hardcoding into the prototype.
- **A mockup is decision evidence, not a branch to merge.** Built on the real components it will look ready, while carrying fictional data, no state wiring, no error handling, no i18n and no tests. What legitimately carries over is its **structure and component composition**, as a reference for the implementation; pasting the files in wholesale makes a gitignored artifact load-bearing.

## Writing the spec

`docs/specs/<spec-slug>.md` is the single basis for what this change "should do". When the implementation, the tests or a report later conflict with the spec, **revise the spec and get agreement again** — do not let code silently rewrite the requirements.

**The spec settles what must be true and what is out of bounds; it does not carry a checklist, and it does not say how.** The route is the plan's ([`writing-plans`](../writing-plans/SKILL.md)); the commands, the expected output and the verdicts belong to the round that implements it, which [verifies against this file](../executing-plans/SKILL.md#wrap-up-two-reviews-at-once) and reports one verdict per requirement. Keeping a second checkable list here means the same sentence in two documents with nothing to catch them drifting apart, and it pulls the spec down into how the work will be done.

**What this puts on the prose is real.** The plan is gitignored and states no requirements, so **this file is the only committed, durable statement of what the change owes** — and it is what a verifier subagent, with no memory of this conversation, will hold the diff against. Say each requirement observably enough that someone can build the check from it without asking you.

Before writing, mark every fact as one of three kinds: verified in the repository, decided by the user, still unknown. Something still unknown that would change what the thing has to do is a stop-and-ask, not a TBD.

Choose **the fewest and highest test seams possible**: prefer a user-observable boundary or a public interface, then a module interface; do not expose internals for the sake of testing. Put them in the spec's testing decisions and **confirm that table with the user** — agreeing the seams up front is how the testing effort lands on the critical paths instead of on every edge case, and it is cheap to agree before anything is written and expensive after.

### File naming

**slug = the date it was created + a short name**, the short name in lowercase kebab-case:

```
docs/specs/2026-07-27-oauth-login.md
```

- **The date is the day this file was created**, not the day the requirement was raised, nor the day it was finished. **It does not change once created** — the mockup directory and later evidence directories reference this slug, so renaming breaks all of them at once. When the requirement later changes, change the content (adding a revision note if needed), not the file name.
- Two specs created on the same day are distinguished by their short names, which must stand on their own (`2026-07-27-oauth-login`, not `2026-07-27-fix`).
- The slug also determines `.dev-kit/artifacts/<spec-slug>/` (mockups and other local working material).
- **If the project already has a spec directory, follow its existing naming** (an early project might use the singular `docs/spec/`, or hold older files with no date prefix; just go with it). **Do not bulk-rename existing specs for consistency** — that breaks every link pointing at them, for a benefit far smaller than the cost. New ones follow the rules above.
- **Do not put a formal spec in `.dev-kit/`.** It is gitignored; a spec has to be readable by a reviewer and on another machine.

### Required structure

Copy [spec-template.md](references/spec-template.md) and trim it to the project — **its HTML comments are instructions to you, and get deleted along with everything else you fill in.** The following cannot be missing:

- A one-line **objective** and a one-line **hard invariant** — what this is for, and what must not regress whatever else changes
- The **problem**, numbered, **each entry pointing at its evidence** (file and line, a command and its output, an observed session, a user report). A problem nobody can locate is a preference. An observed failure outranks a document admitting the gap; where only the latter exists, the entry says so
- Actors and user stories
- **Design decisions**, numbered, with the rejected options in the same row — including the ones **you took yourself without the user's sign-off**. **One or two sentences per row**: where a section below develops the reasoning, point at it instead of arguing it twice. Do not write specific file paths or large blocks of code, which go stale
- **The change itself as design prose**, in section headings drawn from its own vocabulary, covering the user flow; state, contracts and failure semantics; UI and interaction where there is any; and security, privacy, compatibility and accessibility — with the reason stated where one does not apply
- **Out of scope**
- **Testing decisions**: the seams, what each verifies, prior art — confirmed with the user — plus the deliberate trade-offs (what is not automatable and gets verified by review instead)
- Relative links to UI prototypes, diagrams or external material

### What gets numbered, and what deliberately does not

**Number the problems and the decisions. Do not number the requirements.**

A requirement drifts as the design settles, so an id attached to one is a handle onto something still moving — and keeping a second numbered list of acceptance items beside it means writing the same sentence twice and maintaining the agreement between the copies. The requirements belong in the design prose, where they read as what the thing does.

A **decision** is the opposite: it is the part someone argues with three weeks later, and an argument needs to name the row it disagrees with. A **problem** needs a number for the same reason, plus its evidence.

**Every requirement in the prose must be able to answer "given what precondition, performing what action, observing what result".** "Works properly", "feels good" and "covers the edge cases" are all unacceptable — not because a checklist is coming, but because a requirement nobody can observe cannot be built to, reviewed against, or turned into a check later.

### UI evidence

Reference the agreed HTML or screenshots in `.dev-kit/artifacts/<spec-slug>/mockups/` and state what they determine (hierarchy, layout, state or interaction) and what is merely indicative. Where colours, spacing or components already have a design system, reference the token and component names rather than copying a parallel design system into the spec.

**Note that this link is local**: the spec is committed to Git while `.dev-kit/` is not — for a reviewer, and for you on another machine, that link does not open. So **anything decisive goes into the spec as prose** (hierarchy, states, interactions, constraints), with the mockup only as supporting evidence; add "local artifact, not in Git" next to the link. **The spec must be readable on its own without the mockup.**

When the prototype genuinely needs to travel with the spec, check what the repository already does (`git ls-files '*.png' '*.jpg' | head`) and follow it: a repo that already commits images gets the one or two finalised screenshots committed alongside the spec, and one that commits none gets prose plus a note that the artifact is local. Say which way you went and why — a one-word override for the user, not a question worth stopping for.

## Self-check before the gate

Go through this and fix things directly. **When an item does not hold, cutting is usually the fix, not adding** — this list is for finding what does not belong, and a spec padded out so every box can be ticked is worse than the one you started with:

- [ ] The user's goal, the primary actor and the observable success outcome are settled
- [ ] Scope, non-goals and compatibility / security / privacy / accessibility constraints are settled, with a stated reason where one does not apply
- [ ] Key failure states and recovery paths are settled
- [ ] The option comparison and the reasoning for the choice were agreed, and both are in the design decisions
- [ ] Everything taken to the user was a decision that changes observable behaviour; the rest is decided, with its basis, and written into the design decisions
- [ ] No TBD / TODO / placeholder, no internal contradiction, no undefined term
- [ ] There is an objective line and a hard-invariant line, and the invariant is something an implementation could actually violate
- [ ] Every numbered problem points at its evidence, and says so plainly where that evidence is only a document admitting the gap; every numbered decision carries the option it beat and why, without re-arguing a case a section below already makes
- [ ] Any design decision's claim about what an external library, tool, spec or RFC does points at the thing itself — opened, with a version, path, URL or git ref — not recollection; where it could not be reached, that is stated and the claim marked unverified
- [ ] **Nothing here was not asked for**: no field, flag, layer or extension point whose only consumer is a future round, and no requirement traceable to neither the problems nor something the user said. Speculative ideas go in Out of scope, where they cost nothing and bind no one
- [ ] The prose covers the main path **and** the edges this change genuinely owns (empty state, boundary value, dependency failure, permission denial — whichever it has); where it truly has none, that is stated rather than a paragraph being manufactured
- [ ] Every requirement is stated observably enough that someone else could write the check for it without asking you — and there is **no checklist of commands or verdicts** here, those belonging to the round that implements it
- [ ] Testing decisions name the seams and were confirmed with the user; what is not automatable says so plainly instead of being dressed up as an assertion
- [ ] UI decisions have a mockup, or a clear statement of why prose is sufficient; a mockup's tokens and components come from the project's design system, and anything genuinely new is named as a new token
- [ ] Anything decisive about the UI is readable in the spec without opening the mockup
- [ ] The spec is small enough to be implemented as one piece of work; otherwise split it
- [ ] Every link exists, and no artifact contains real credentials or personal data
- [ ] No unimplemented technical idea is written as a verified fact

## The user gate, then commit

Send **the file path and a short summary** to the user for review. Only after explicit approval do you commit. After changing requirements, come back through the self-check.

**The moment it is approved, commit it — on the branch you are standing on.**

```bash
git add docs/specs/<spec-slug>.md
git commit -m "docs: spec for <short name>"   # follow the project's existing commit convention
```

**Why here and not later.** An uncommitted spec is a working-tree file in one workspace: an isolated workspace cut from `HEAD` (`git worktree add`) does not contain it, another machine does not have it, and a subagent told to work from the spec finds a missing file. By the time anyone notices, work has already started from a base with no spec behind it.

**Add the spec by path, not the whole workspace.** The workspace usually holds other work in hand, and `git add -A` sweeps it into a commit labelled "spec". The spec file, plus any mockup screenshot the project actually commits, and nothing else.

**The current branch is usually the baseline, and that is where the spec belongs.** A spec is the agreed basis for the requirement, not one round's implementation: it stays true whether the implementation lands or gets thrown away, and any branch cut afterwards can see it. This does not mean pushing the baseline — an implementation branch cut from this commit carries the spec along as an ancestor, and it shows up in the PR like any other commit.

**A revision later gets committed the same way, wherever you are working at that point.** The rule this section fixes is only the first one: nothing starts from a base with an uncommitted spec behind it.

## Red Flags

| Thought | Reality |
|---|---|
| "This is simple, write it and see" | Even a small requirement hides defaults and failure behaviour; the design may be short, the agreement may not be skipped. |
| "Asking all the questions at once is faster" | The user will miss some and the options interact; one key question at a time. |
| "Better ask the user about this one too, to be safe" | The more you ask the less each question weighs, and you end up with a string of "whatever"s. Only take decisions that change observable behaviour; decide the rest yourself and write them into the design decisions. |
| "The user said fine, so start coding" | Fix the agreed design into `docs/specs/*` first. The design being agreed is not the spec being approved. |
| "We agreed every section, so approval is a formality" | That is the second gate collapsing. What gets approved is the written file — a paragraph nobody objected to while talking often reads differently once it is what you are going to build. |
| "Just agreed it, I will turn it into a spec later" | A context compaction and a session break sit in between, and dozens of exchanges are expensive to redo. Write it now. |
| "We covered it in the conversation, no need to write it down" | Across sessions a conversation is not a reliable interface. |
| "Listing plenty of user stories makes it complete" | A story with no observable behaviour written under it cannot be built to or reviewed against. The prose is where that behaviour gets stated. |
| "I will number the requirements R1, R2 so they can be traced" | Numbers go on the problems and the decisions. A requirement moves while the design settles, so an id on one is a handle onto something still moving. |
| "Add an acceptance table so each requirement has an id to point at" | That table is the same sentence written twice, with the agreement between the copies left for someone to maintain. The requirement goes in the prose, once. |
| "A short checklist at the end would make this concrete" | Concrete is a property of the sentence, not of the checkbox in front of it. A list of commands here is the implementing round's verification moved up a level, where nothing will keep it in step with the code. Make the prose observable instead. |
| "The tests are the only durable record, so keep a copy of the checks here to be safe" | Then you own two lists and no mechanism to keep them equal, which is the thing that was just removed. What the spec owes a later reader is the requirement stated clearly enough to rebuild the checks from. |
| "Hard-coding the code path makes it more concrete" | Paths drift; a spec states boundaries, contracts and decisions. |
| "Prose is enough for a UI requirement" | When layout, density, hierarchy or responsiveness are in dispute, HTML is the cheaper shared language. |
| "It is only a prototype, any colours and spacing will do" | Agreement reached on a design the codebase cannot build is not agreement — the implementation hits `docs/design.md`'s Core Constraints and the colour-token lint, and you go back having already spent the user's nod. |
| "It is built on the real components, so just merge it" | Real components make it look shippable while the fictional data, missing states, absent i18n and absent tests come along for free. Carry the structure over as a reference. |
| "The implementation is finished, just add a spec" | That is a manual, not spec-driven development; label it explicitly as a description of the current state. |
| "The user did not ask me to commit it" | Approval *is* the gate, and it has just been passed; the commit after it is mechanical. What needs their word is the content, not `git add`. |
| "Leave it uncommitted, whoever implements it will pick it up" | They will not. An isolated workspace checks out `HEAD`, and on another machine the file does not exist at all. |
| "The requirement changed, so the date in the file name has to change too" | The prefix is the **creation day**. Renaming breaks the mockup directory's and the evidence directories' references at once; the last update goes on the line in the file header. |
| "Dispatch a subagent to write the spec and show me" | A spec's entire value is that it was **agreed with the user**, and a subagent cannot ask the user. Fact-finding can be dispatched; writing it and taking it through the gate cannot. |
| "I know how this library/tool works, no need to open it" | Knowing is not the same as having checked. A decision that rejects an option needs the option opened, not recalled — where it cannot be reached, say so and mark the claim unverified. |

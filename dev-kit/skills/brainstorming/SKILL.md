---
name: brainstorming
description: >-
  Use before any implementation — adding a feature, changing behaviour, designing UI — even when the requirement already feels clear, and again when an agreed one turns out wrong. Ends in a user-approved spec. Not for: factual Q&A or read-only investigation.
---

# Requirements exploration and specification (brainstorming)

**This is where a round starts.** Anything that changes behaviour enters the chain here and leaves with an approved, committed spec plus a slug every later stage reuses. [The end of this skill](#what-happens-after-the-spec) names the next stage.

**A pure bug fix still gets a spec**, small: the symptom, the promised behaviour, non-goals, and what would count as a regression. Pure documentation and mechanical formatting can skip it — say so, and say why.

**The spec sets the round's language, and it is the language the user is asking in** — ask in Chinese, get a Chinese spec, Chinese mockup copy, and Chinese reports from every later stage; machine-facing tokens (field names, commands, ids, slugs) stay ASCII. Where the repository already has contributor docs in another language, follow the repository: read that off the files rather than asking, translate wholesale, never interleave two languages.

## Hard gate

**Do not write production code, test code, migrations or scaffolding before the user has agreed the design.** The only writing allowed during exploration is `.dev-kit/artifacts/<spec-slug>/mockups/`, with the user's consent.

This skill's end point is an approved spec, committed — not an implementation.

## Two gates, and they are not the same shape

| | What is approved | Its shape |
|---|---|---|
| Design agreement (during exploration) | The direction: scope, flows, failure behaviour, the option that won | Conversational, section by section |
| Spec approval (after writing) | The written file | "Here is a finished document, veto what you disagree with." The user **reads the file** |

**The second is not a formality the first makes redundant.** A paragraph nobody objected to while talking often reads differently once it is written down as the thing you are going to build.

## Order

1. **Read-only exploration** — the project docs, the relevant code, existing tests, recent related commits. Run the suite once: a spec cannot state what counts as a regression against a baseline nobody looked at. A red baseline goes into the spec's problems as an observed fact, or is named pre-existing and out of scope. Distinguish verified facts, user statements and speculation. **Fix the slug now** — `YYYY-MM-DD-<lowercase-short-name>`, taking today — because the mockup and evidence directories follow it.
2. **Decide whether the requirement needs splitting.** Several independently shippable subsystems means giving the split and the dependency order first, then carrying on with the first spec only.
3. **Ask one question at a time**, only about things that change scope, interaction or how it is accepted — purpose, primary users, success criteria, failure behaviour, compatibility boundaries. **Do not ask what the repository can answer.**
4. **Give 2–3 options**, recommendation first, each stating user impact, implementation and maintenance cost, risks, and what it gives up. Delete extension points no current requirement asks for.
5. **Present the design** — user flow, boundaries, state and data flow, errors and recovery, test seams — sectioned by complexity, with agreement on each section before continuing.
6. **Write the spec** into `docs/specs/<spec-slug>.md`, immediately once the design is agreed: until then the conclusions live only in the conversation, and a compaction or session break loses dozens of exchanges.
7. **Self-check, then send the path** and wait for explicit approval.
8. **Commit the approved spec** on the current branch, by path.

A still-open question cannot be carried into the spec if it would change what the thing has to do. Settle it, or state which part it blocks — no TBD.

## Only significant decisions go to the user

**The more you ask, the less each question weighs.** The criterion is whether the decision changes behaviour the user can observe:

| Take to the user | Decide yourself |
|---|---|
| Scope and non-goals | Which library, how the code is layered, how functions are split |
| Flows, interactions and copy the user can see | Internal data structures and naming |
| Behaviour on failure: error, retry, or degrade to what | Log format, internal error code values |
| Compatibility floors, privacy and permission boundaries | How the tests are organised |
| Anything where guessing wrong means rework | Anything cheap to change after guessing wrong |

The ones you decide yourself still get recorded — into the spec's numbered design decisions, with what was rejected and why. **The reasoning is worth more than the conclusion**: it is the only thing that will stop someone changing it back.

**"Decide yourself" is not "guess".** Every entry in that column owes evidence: a precedent at `file:line`, or a refutable sentence like "the ecosystem default is X and this project holds no evidence to the contrary". A claim about what an external library, tool or spec does is checked the same way: open the thing, do not recall it. Full treatment in [asking-users.md](../using-dev-kit/references/asking-users.md).

## Which parts get a subagent

Step 4's options suit parallel dispatch — one subagent per option, drafted independently, since written serially the second grows along the first one's frame. The same for step 1's exploration when the surface is wide (one module each, "conclusion + `file:line`") and for several mockup variants (one directory each). Comparing them, ordering the recommendation and extracting the shared premises stay in the main session.

**Four things never get dispatched:** asking the user, waiting for agreement, deciding whether a requirement needs splitting, and writing the spec itself — a spec's entire value is that it was agreed, and a subagent cannot reach the user. Fact-finding can be dispatched; the gate cannot.

## UI and HTML mockups

Three judgements; the mechanism is in [mockups.md](references/mockups.md).

- **When.** Only where a visual rendering lowers the communication cost — layout, density, hierarchy or responsive behaviour genuinely undecided. Then say you are going to build one and what it will settle, and build it: a heads-up, not a question.
- **Use the project's real tokens and components** — read its `docs/design.md` first, or source the same facts from the token file and an existing well-built page. Otherwise the design the user nods at is one the codebase cannot build. A value the design system has no name for is proposed as a new token in the spec, not hardcoded.
- **A mockup is decision evidence, not a branch to merge.** What carries over is its structure and component composition, as a reference; pasting the files in wholesale makes a gitignored artifact load-bearing.

## Writing the spec

`docs/specs/<spec-slug>.md` is the single basis for what this change should do. When the implementation, the tests or a report later conflict with it, **revise the spec and get agreement again.**

It settles what must be true and what is out of bounds; it carries no checklist, and it does not say how. The route is the plan's ([`writing-plans`](../writing-plans/SKILL.md)); the commands and verdicts belong to the round that implements it, which [verifies against this file](../executing-plans/SKILL.md#wrap-up-two-reviews-at-once). **The plan is gitignored and states no requirements, so this file is the only committed, durable statement of what the change owes** — and what a verifier subagent, with no memory of this conversation, holds the diff against.

Before writing, mark every fact as verified in the repository, decided by the user, or still unknown. Something unknown that changes what the thing has to do is a stop-and-ask.

Choose **the fewest and highest test seams possible**: a user-observable boundary or public interface first, then a module interface; do not expose internals for testing. Put them in the testing decisions and confirm that table with the user — cheap before anything is written, expensive after.

### File naming

**slug = the date it was created + a short name** in lowercase kebab-case:

```
docs/specs/2026-07-27-oauth-login.md
```

**This slug is the only name the whole chain uses** — the plan file, the branch, the worktree directory, `.dev-kit/artifacts/<spec-slug>/` and `e2e/scratch/<spec-slug>/` all take it.

- The date is the day this file was created — not raised, not finished — and **it does not change**. When the requirement changes, change the content, not the name.
- Same-day specs are distinguished by short names that stand on their own (`2026-07-27-oauth-login`, not `2026-07-27-fix`).
- Where the project already has a spec directory, follow its naming, and **do not bulk-rename existing specs** — that breaks every link pointing at them.
- **Do not put a formal spec in `.dev-kit/`**: it is gitignored, and a spec has to be readable by a reviewer and on another machine.

### Required structure

Copy [spec-template.md](references/spec-template.md) and trim it to the project — its HTML comments are instructions to you, and get deleted along with everything else you fill in. The following cannot be missing:

- A one-line **objective** and a one-line **hard invariant** — what this is for, and what must not regress whatever else changes
- The **problem**, numbered, each entry pointing at its evidence (file and line, a command and its output, an observed session, a user report). An observed failure outranks a document admitting the gap; where only the latter exists, the entry says so
- Actors and user stories
- **Design decisions**, numbered, with the rejected options in the same row — including those you took without sign-off. One or two sentences each, pointing at the section that develops the reasoning. No file paths or large code blocks, which go stale
- **The change itself as design prose**, in headings from its own vocabulary: the user flow; state, contracts and failure semantics; UI and interaction; security, privacy, compatibility and accessibility — with the reason stated where one does not apply
- **Out of scope**
- **Testing decisions**: the seams, what each verifies, prior art — confirmed with the user — plus what is not automatable and gets verified by review instead
- Relative links to UI prototypes, diagrams or external material

**Number the problems and the decisions. Do not number the requirements.** A requirement drifts as the design settles, so an id on one is a handle onto something still moving, and a second numbered list of acceptance items means maintaining the agreement between two copies. A decision is the opposite: it is what someone argues with three weeks later, and an argument needs to name the row it disagrees with.

**Every requirement in the prose must answer "given what precondition, performing what action, observing what result".** "Works properly" and "covers the edge cases" cannot be built to, reviewed against, or turned into a check later.

### UI evidence

Reference the agreed HTML or screenshots in `.dev-kit/artifacts/<spec-slug>/mockups/`, stating what they determine and what is merely indicative, and using the design system's token and component names.

That link is local — the spec is committed while `.dev-kit/` is not. **Anything decisive goes into the spec as prose**, with the mockup as supporting evidence and "local artifact, not in Git" next to the link. The spec must be readable without the mockup.

Where the prototype genuinely needs to travel with the spec, follow what the repository already does (`git ls-files '*.png' '*.jpg' | head`): a repo that commits images gets the finalised screenshots committed alongside; one that commits none gets prose plus the note. Say which way you went.

## Self-check before the gate

Fix things directly. When an item does not hold, cutting is usually the fix, not adding.

- [ ] The user's goal, the primary actor and the observable success outcome are settled
- [ ] Scope, non-goals and compatibility / security / privacy / accessibility constraints are settled, with a reason where one does not apply
- [ ] Key failure states and recovery paths are settled
- [ ] The option comparison and the reasoning for the choice are in the design decisions
- [ ] Everything taken to the user changes observable behaviour; the rest is decided, with its basis
- [ ] No TBD / TODO / placeholder, no internal contradiction, no undefined term
- [ ] There is an objective line and a hard-invariant line, and the invariant is something an implementation could violate
- [ ] Every numbered problem points at its evidence; every numbered decision carries the option it beat and why
- [ ] Any claim about an external library, tool, spec or RFC points at the thing itself, opened — or is marked unverified
- [ ] **Nothing here was not asked for**: no field, flag, layer or extension point whose only consumer is a future round. Speculative ideas go in Out of scope
- [ ] The prose covers the main path **and** the edges this change owns; where it has none, that is stated
- [ ] Every requirement is observable enough for someone else to write the check — and there is no checklist of commands or verdicts here
- [ ] Testing decisions name the seams and were confirmed with the user
- [ ] UI decisions have a mockup or a statement of why prose suffices, on the project's own tokens, and are readable without opening it
- [ ] The spec is small enough to implement as one piece of work; otherwise split it
- [ ] Every link exists, and no artifact contains real credentials or personal data

## The user gate, then commit

Send the file path and a short summary. Only after explicit approval do you commit; after changing requirements, come back through the self-check.

```bash
git add docs/specs/<spec-slug>.md
git commit -m "docs: spec for <short name>"   # follow the project's existing commit convention
```

**Why here and not later.** An uncommitted spec is a working-tree file in one workspace: a worktree cut from `HEAD` does not contain it, another machine does not have it, and a subagent told to work from it finds a missing file.

**Add the spec by path, not the whole workspace** — the workspace usually holds other work, and `git add -A` sweeps it into a commit labelled "spec".

The current branch is the baseline, and that is where the spec belongs. It stays true whether the implementation lands or gets thrown away, and a branch cut from this commit carries it along as an ancestor into the PR. A revision later gets committed the same way, wherever you are working.

## What happens after the spec

The spec is committed. **Now count the steps the change breaks into, and take one of two routes** — say which, and on what count, before the first edit:

| The change | Next |
|---|---|
| More than about three steps, or it will span sessions | [`writing-plans`](../writing-plans/SKILL.md) |
| Three steps or fewer, holding inside one session | **No plan.** Straight to [`using-git-worktrees`](../using-git-worktrees/SKILL.md), then the work runs as a single slice through `test-driven-development` |

**Neither route reaches code without going through `using-git-worktrees` first**, even when the answer is "no worktree": a branch is not optional, and that skill owns the branch decision as well as the isolation one.

Whichever route, [what every round owes](../using-dev-kit/SKILL.md#what-every-round-owes-whatever-its-size) is unchanged.

**On the short route that review has no plan to hang off**, so it is one dispatch over the whole diff, carrying both headings: does it do what the spec says, and is the code right. With nobody to dispatch to it becomes a handover — give the user the diff and that prompt, and do not rule it finished until it comes back.

**Coming back here later is normal, not a failure.** A requirement that turns out wrong during implementation, or a reviewer asking for behaviour nobody agreed, re-enters at the top of this skill and leaves through this same gate — the spec is revised and re-approved, never patched to match what the code did.

## Red Flags

| Thought | Reality |
|---|---|
| "The user said fine, so start coding" | The design being agreed is not the spec being approved. |
| "Just agreed it, I will turn it into a spec later" | A compaction and a session break sit in between. Write it now. |
| "I will number the requirements, or add an acceptance table" | The same sentence twice, with nothing keeping the copies equal. Numbers go on problems and decisions. |
| "Dispatch a subagent to write the spec and show me" | A spec's value is that it was agreed, and a subagent cannot reach the user. |
| "Leave it uncommitted, whoever implements it will pick it up" | A worktree checks out `HEAD`; on another machine the file does not exist. |

---
name: using-dev-kit
description: >-
  Use at the start of any development session, and again before writing code, running a command, or asking the user a clarifying question. Reach for it when the user asks "what does dev-kit do", "what skills do you have", "which skill should I use", "how should I go about this", or when a change looks small enough to skip a stage and you need to know what still applies to it. Not for: doing the work once the right skill has been named — invoke that skill — or questions with no development work behind them.
---

<SUBAGENT-SCOPE>
If you are a subagent dispatched to carry out one specific sub-task: **skip the orchestration parts of this skill** — do not open a spec of your own, do not take the whole requirement over, and do not try to ask the user anything (you cannot reach them).

Do the sub-task you were given and report back **the evidence**: the commands you ran with their exit codes, `file:line` for anything you claim about the repository, and what you actually observed. Let the main session judge whether that is enough — **do not declare the task complete yourself.**
</SUBAGENT-SCOPE>

# Using dev-kit

dev-kit is a set of **development workflow skills**. This bootstrap says which ones exist and when you should reach for them.

## Rules

**Check for an applicable skill before you start** — before writing code, running commands, even before asking a clarifying question. If you think there is so much as a 1% chance a skill applies, invoke it. If it turns out not to fit, drop it then.

How to invoke:

- On a harness with a `Skill` tool (Claude Code and friends), invoke through that tool, with a namespace of the form `dev-kit:<skill-name>`.
- On harnesses like Codex / Pi, read the corresponding `skills/<name>/SKILL.md` directly and follow its contents.

After invoking, first state "using \<skill\> to \<purpose\>", then follow the skill strictly; if the skill contains a checklist, create one todo per item.

## What language to write in

**The skill instructions are in English. What you write into the user's repository follows the language the user is asking in.** Ask in Chinese → the spec, the mockup copy and the reports come out in Chinese; ask in English → English.

Machine-facing tokens stay ASCII whatever the prose language: field names, command names, ids, file slugs.

One exception: **if the repository already has contributor docs in a different language, follow the repository** — half a repo in one language and half in another is worse than either choice, and which language to match is something you read off the files rather than ask about; the user can override in a word. Translate wholesale, keeping structure and links; do not interleave two languages.

## Available skills

| Skill | When to use |
|-------|--------|
| `init` | **When a project needs its "agent constraint system" set up or filled in.** Generates AGENTS.md / CLAUDE.md / layered docs, pins the high-value conventions into lint guardrails wired into CI, scaffolds the twin unit-test and e2e tracks, and sets up logging and observability conventions as needed. Also used on an older project to work through the checklist when "the docs are stale / there are no guardrails / the same class of problem keeps recurring". |
| `brainstorming` | **When adding a feature, changing behaviour, designing UI, or when the requirements are still vague — and equally when the requirement is already clear and only needs writing down.** Explores intent read-only, asks one question at a time, compares options and secures agreement; where a visual choice is involved, builds HTML mockups under `.dev-kit/artifacts/<spec-slug>/mockups/`. **Ends by writing the agreed requirements into `docs/specs/<spec-slug>.md`, taking that file through the user, and committing it.** |
| `using-git-worktrees` | **Before starting to implement**, and again when wrapping up to deliver the branch — also when trying a path that may be thrown away entirely, or when the current workspace still holds unrelated uncommitted changes. Shuts this round into its own directory and branch; **do not implement on main / master**. Detect an isolation you may already be in first, ask the user once rather than estimating the install cost, **make sure the approved spec is committed before cutting** (a worktree only ever sees `HEAD`), and prefer the harness's own worktree tool over `git worktree add` where there is one. Delivery ends in a menu — merge / PR / leave it — with your recommendation, and **what wrap-up learned is stated before the options**: every acceptance sentence not demonstrably true, the findings let stand, and any behaviour left unobserved. Cleanup removes only the workspace you created. **The branch has a life after the menu**: PR feedback comes back through the chain by size — a new round for the substantial, a straight fix under [the same standing obligations](#what-every-round-owes-whatever-its-size) for the rest. |
| `test-driven-development` | **When implementing new behaviour, fixing a reproducible bug, or changing a public contract.** Failing test first, watched failing for the right reason, then the minimum code that makes it pass — one happy path plus the edge or failure case the contract genuinely owns, per round. **It does not require a spec**: with one, it takes the sentence it is making true from that spec's requirements and testing decisions; without one, it writes that sentence itself. How tests are designed comes from the project's `docs/testing.md` (the one `init` generates), so that the standard belongs to the project rather than to this kit. |
| `systematic-debugging` | **On a bug, a test or build failure, a performance regression, an intermittent fault, or behaviour that does not match the spec — before proposing a fix.** No fix without a reproduction and a root cause: define the deviation, reproduce it, attribute the evidence to the right tree, instrument the boundaries, compare against something that works, and test one hypothesis at a time. The diagnostic phase is **read-only**, and an experiment that writes to an external system or production data needs the user's word first. Ends by handing the reproduction to `test-driven-development` as the failing test. Three attempts that do not move the evidence is a finding about the design, not a reason to try a fourth. |

> **When a skill is added to dev-kit, update this table with it in the same change** — along with the chain below, if it is a stage of it, and whatever catalogue the kit is installed from. This table is how a session finds out a skill exists at all, and the catalogue is how anyone installs it; a skill missing from either is a skill nobody reaches.

## The spec-driven chain, as far as it currently goes

**As far as it currently goes is end to end**: requirement, approved spec, isolated workspace, the implementation rounds, the wrap-up review and gates, delivery. `init` is not a stage of it — it sets up the project the chain runs inside, and is reached for on its own. **When a gap opens up again, write it here**, because a gap nobody wrote down is one the next session finds out about mid-round.

```text
requirement / fault
  → brainstorming
       ├ read-only exploration: docs, the relevant code, existing tests, related commits
       ├ one question at a time — only decisions that change observable behaviour
       ├ 2–3 options, recommendation first, with what each gives up
       ├ (visual choice) HTML mockup in .dev-kit/artifacts/<spec-slug>/mockups/
       ├ design agreed with the user, section by section
       ├ written into docs/specs/<spec-slug>.md
       ├ ← gate: the user approves the written file (reading it, not recalling the conversation)
       └ committed on the current branch, by path
  → using-git-worktrees
       ├ already in an isolated workspace? detect before creating a second one
       ├ ask the user once — the install cost is a fact about their machine, not the repo
       ├ the approved spec must be committed before cutting: a worktree only sees HEAD
       ├ the harness's own worktree tool where there is one, else git worktree add — one name
       │   from the spec's slug for both branch and directory, into whatever location this
       │   project already uses, else .dev-kit/worktree/
       └ every path then owes the same setup: install, and run the baseline before the first
           change, so a failure you inherited is never mistaken for one you caused
  → implementation — cut the work into vertical slices and take them one at a time
       ├ a slice is a complete capability, not a layer: never "write the tests" as its own
       │   slice, and never a slice whose result nobody can observe
       ├ before the first edit, say what will be observably true afterwards that is not true
       │   now — taken from the spec's requirements, one sentence per slice
       │  ↳ test-driven-development, one whole round per slice
       │     ├ one sentence you are making true — taken from the spec's requirements and
       │     │   testing decisions, or written yourself when there is no spec
       │     ├ boundary per docs/testing.md: the narrowest one that can observe the real
       │     │   contract
       │     ├ RED → verify it fails for the missing behaviour → GREEN → verify the target
       │     │   test and the affected suites → REFACTOR, and repeat one slice at a time
       │     ├ one happy path + the edge or failure case the contract genuinely owns, per round
       │     ↘ on a fault → systematic-debugging: no fix without a reproduction and a root
       │         cause. Define the deviation, reproduce, attribute the evidence, instrument
       │         the component boundaries, compare against what works, one hypothesis per
       │         experiment. Read-only until the cause is established. The reproduction comes
       │         back as this loop's RED, and three attempts that do not move the evidence is
       │         a finding, not a fourth guess
       ├ a slice is finished against a command, an exit code and an observation — never
       │   against how confident the code looks
       ├ one commit per slice
       └ expensive verification — e2e, starting the real application — happens once at the
           end, never per slice
  → wrap-up, two steps in an order that cannot swap
       1 overall review — the whole branch's diff in one pass, code axis and spec axis under
         separate headings. Dispatch it: reviewing your own branch inside the context that
         wrote it provides none of the isolation the review exists to buy
       2 project gates + acceptance — the project's existing test / lint / build entry
         points, then each acceptance sentence checked and its verdict stated. Dispatch the
         runs too, for context rather than for isolation: what comes back is an observation,
         and the verdict is yours to write from it
       ↘ no separate report by default; write one only when the evidence cannot be command
         output (screenshots, recordings, before-and-after data), and ask the user first
  → delivery (using-git-worktrees again)
       ├ the full suite runs once more on the tree actually being delivered
       ├ what wrap-up learned, stated before the options: every acceptance sentence not
         demonstrably true, the findings let stand, anything left unobserved — say it out
         loud, because anything under .dev-kit/ is gitignored and never reaches them
       ├ merge / open a PR / leave it — their call, your recommendation and its evidence
       ├ PR feedback routes back in by size, under the same standing obligations
       └ cleanup removes only the workspace you created, and never by rm -rf
```

**`test-driven-development` does not check whether a spec exists.** It takes the sentence it is making true from one when there is one, and writes that sentence itself when there is not — so picking the skill up mid-implementation works, and so does a change that legitimately skipped the spec under the rule below. **Whether a change owes a spec is that rule's call, not this skill's.** The one thing the loop will not do is run *before* the requirement is settled: writing the failing test first buys nothing when the sentence it makes true is a guess.

**Naming**: the spec file is `docs/specs/YYYY-MM-DD-<lowercase-short-name>.md`, the date being **the day the file was created**. It is not renamed afterwards — the branch, the worktree directory, the mockup directory and any later evidence directory all follow that slug, so renaming breaks all of them at once.

**Stages can be skipped against a criterion; they cannot be skipped silently.** A pure bug fix still gets a small spec — at minimum the symptom, the promised behaviour, non-goals and what would count as a regression. Pure documentation or mechanical formatting changes can skip the spec, with the reason stated. The worktree can be skipped where the workspace holds no unrelated uncommitted changes, the change is not one you might throw away whole, and you are not standing on main / master — any of the three failing, cut one. **A branch is never optional: do not commit to main / master on any path.**

## What every round owes, whatever its size

**Stages come off against criteria. These do not come off at all** — not for a two-line change, not for a change the user described perfectly, not for one you are nearly finished with.

- **`test-driven-development`, in full.** On a small change with no slice list, it is the entire structure holding the work together, so shortening a round there removes the last thing there was. It needs no spec — it writes the sentence it is making true itself.
- **The evidence bar.** Finished means a command, an exit code and an observation. "It is a two-line change" is a description of the diff, not a verification of it.
- **One review, dispatched, before the change is called finished.** **Nothing is judged complete inside the context that produced it, and that invariant has no size exemption** — a small change reviewed by its own author is exactly the case where "it is obviously fine" goes unchallenged. Its scope is **the whole diff of this change against the branch point, read once**, on two axes under separate headings — code axis and spec axis, the spec axis skipped in one line where there legitimately is no spec.

  **With nobody to dispatch to, this becomes a handover, not an inline pass.** A fresh session is something the user can open even where you cannot, so give them the diff and the prompt, say the change is not finished until the review comes back, and **do not rule it finished in the meantime.** **Reviewing it yourself and disclosing that you did is not the degraded form of this step, it is the absence of it.**
- **Say what you skipped and why, before the first edit.** One line: which stages came off, against which criterion. That line is the only artifact standing where a skipped stage's gate would be; unwritten, nobody can tell a judged shortcut from a forgotten one.

**Where the evidence goes.** **The test you wrote is the durable record** — it is in the tree, it re-runs, and it outlives this session. The commands, exit codes and observations go into what you hand back to the user, and into the commit message where the project's convention has room. **Write a file only when the evidence cannot be command output** — screenshots, before-and-after data — and it lands at `.dev-kit/artifacts/<spec-slug>/verification.md`, on the same slug as the mockups and diagnostics; where the spec was legitimately skipped there is no slug to inherit, so take one of the same shape, today's date plus a short name. `.dev-kit/` is gitignored, so **nothing decisive may live only there**: a reviewer, or you on another machine, cannot open it.

**How it ends.** **You rule it finished, not the reviewer** — against three things together: the review back with nothing open, the project's existing test / lint / build entry points green, and every acceptance sentence demonstrably true. Delivery is the same menu as ever — merge, open a PR, or leave it, their call with your recommendation and its evidence, per [`using-git-worktrees`](../using-git-worktrees/SKILL.md). **Do not merge it yourself.**

**Escalate rather than push on** the moment any of these shows up:

- **the review returns a finding you cannot close with a test or a command**, or a second pass does not close it — on a small change you are author and fixer at once, so a finding argued away has nobody left to catch it;
- a decision surfaces that changes behaviour the user can observe — that goes to `brainstorming` under [gate 3 below](#when-to-ask-the-user-look-it-up-decide-it-and-only-then-ask), not into your own judgement;
- the change has grown past what the skipped stages were judged against — **re-judge it, do not defend it.** Picking a stage back up late costs almost nothing: the spec, the tests and the commits you already have carry straight over.

## When to ask the user: look it up, decide it, and only then ask

**The user's attention is the most expensive resource you have — and asking less is not the same as guessing more.** Take every open item through three gates in order, stopping at the first that holds:

| # | Criterion | Action |
|---|---|---|
| 1 | **Findable** in the repo or the environment | Look it up and use it. Keep the command and its output, or `file:line` |
| 2 | Not findable, but **cheap to change if wrong**. The test: **does this decision change behaviour the user can observe?** No → this gate; yes → gate 3 | Decide it yourself, say in one line what you decided and on what basis, carry on. The basis lands in the spec's design decisions |
| 3 | Not findable, and **wrong means rework or an irreversible cost** | Only now ask — with **options + your recommendation first + the basis for it + what happens if they do not answer** |

**Gate 1 is the one that gets skipped wholesale.** "When in doubt, ask" sounds safe, but it swallows the act of looking things up: the base branch is computable with `git merge-base`, whether CI exists is `ls .github/workflows`, what the project does is in the README. Asking a question you could answer yourself trades the user's time for your thirty seconds.

**Every decision you make has to come with evidence.** What you cannot justify is not a decision but a guess — send it back to gate 1 to be looked up, or up to gate 3 to be asked. A bare "I think" is not evidence; "the ecosystem default is X and this project holds no evidence to the contrary" is, because the next session can overturn it.

The three tiers, the table of what counts as evidence for which kind of decision, the four-part form for a question and the per-round ceiling are all in [asking-users.md](references/asking-users.md).

Two gates stay regardless: **the user's approval of the spec** and **`init`'s sign-off on its recommendation list**. They approve *what to build*, and their shape is "here is a finished document, veto it", not a quiz.

> **This table is one of three copies**, and it stays here because a SessionStart hook puts this file into every session — the gates fire before every question, which is not a moment to be opening a reference. [`init`](../init/SKILL.md#b-questions-you-need-answered) carries the second so that it can be used on a project without the rest of this kit; [asking-users.md](references/asking-users.md) holds the third, owns the rule, carries the fuller treatment, and is where the register of all three lives. **Same rule, three places — change one and change all three.**

## What to dispatch to a subagent

The main session is the **orchestrator**: it holds the goal, the constraints, the decisions and the conversation with the user. Work that would flush those out gets dispatched.

**Three properties, all required, for something to be dispatchable:**

| Property | What it means | What happens without it |
|---|---|---|
| **The input can be written down** | The context it needs fits in a prompt, or points at a file on disk | Not being able to write it down means you have not thought it through — go think first, do not dispatch |
| **The output can be verified** | You can judge what comes back: a command plus an exit code, a file you can open, a conclusion you can re-check | If you cannot judge it, you are just letting it happen, and you may as well do it yourself |
| **Loud middle, small conclusion** | Hundreds of lines of intermediate output, with a conclusion of a few lines | Without dispatching, the noise eats the main session's context |

**Three kinds not to dispatch:**

- **Anything needing back-and-forth with the user** — a subagent cannot ask the user. `brainstorming`'s questions and its approval gate, and `init`'s sign-off, all stay in the main session.
- **Tightly coupled short loops** — splitting one tight cycle across two agents leaves half the evidence in someone else's context. `test-driven-development`'s RED→GREEN is the case to know: GREEN needs the specific failure output that RED produced, so the whole round travels together or not at all.
- **Parallel work hitting the same resource** — two agents writing one file, or two runs fighting over the same port and data directory. Parallelism is for **read-only** work, or for work with disjoint outputs.

**The one thing that must be dispatched** is the [wrap-up review](#what-every-round-owes-whatever-its-size) — not for context, but for isolation. Where this lands in each skill is in the individual SKILL.md files (`brainstorming`'s parallel options and exploration, `init`'s deep scan and self-verification, `test-driven-development`'s whole-round dispatch).

## The optional CLI

`devkit serve` starts a read-only local static server over `docs/specs/` and `.dev-kit/artifacts/`, so a mockup that cannot run a dev server can still be opened in a browser (`file://` will not do — it blocks ES module imports on origin grounds).

**It is not required** — it exists for that one mockup case and for browsing artifacts. **Inside a Claude Code session it is on PATH** — a loaded plugin's `bin/` is prepended to the session's PATH, so `devkit` runs as a plain command. Outside a session, or where the kit was installed by copying the skills rather than as a plugin, it is not: if `command -v devkit` finds nothing, run `node "<dev-kit root>/bin/devkit" serve`, the dev-kit root being two levels up from this skill's directory. **`command not found` is not a verdict that there is no CLI** — only the full command failing to run is.

## Red Flags — stop when you catch yourself thinking these

| Thought | Reality |
|------|------|
| "This one is simple, no need to check for a skill" | A question is a task too. Check for a skill first. |
| "Let me understand the code a bit first" | Checking for a skill comes before clarifying or exploring. |
| "The user was perfectly clear, no need for a spec" | A clear conversation is exactly what is easiest to turn into a short spec; whoever implements it still needs a basis that survives the session. |
| "It is a small change, so I will just make it" | Small takes stages off against a criterion — it takes nothing off [the standing obligations](#what-every-round-owes-whatever-its-size): TDD, evidence, and one dispatched review before you call it finished. |
| "It has grown past what I judged it against, but I am nearly done" | The judgement is against the change, not against how far in you are. What you have already built carries over unchanged; re-arguing the boundary is how the cheap route becomes the only route. |
| "The tests will probably pass, just say it is done" | Not run means not done. Every verification comes with a command, an exit code and an observation. |
| "This code is obvious, write it and add the tests afterwards" | A test written against code that already exists is green on its first run, and green proves nothing there — you never saw it fail, so nothing says it would fail if the behaviour broke. `test-driven-development` has the rest. |
| "Not sure about this, better ask the user" | Gate 1 first: is it findable in the repo or the environment? Asking a question you could answer yourself trades their time for your thirty seconds. |
| "Might as well check this one too, to be safe" | The more you ask, the less each question weighs — the payoff is a string of "whatever", with the one question that mattered buried in it. |
| "Asking less is the goal, so I will just pick something" | Picking is fine — where is the basis? What you cannot justify is a guess, not a decision. Look it up, or escalate it to a question. |
| "Here are the options, they can choose" | Options without your recommendation and its basis push the judgement cost onto someone holding less evidence than you. Recommend first, then wait. |

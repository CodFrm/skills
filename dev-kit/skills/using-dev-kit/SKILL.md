---
name: using-dev-kit
description: >-
  Use before writing code, running a command or asking the user a clarifying question — routes to the right dev-kit skill, including when a change looks small enough to skip one.
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

# Using dev-kit

## The rule

**Check for an applicable skill before you start** — before writing code, running commands, even before asking a clarifying question. If there is so much as a 1% chance one applies, invoke it as `dev-kit:<skill-name>`; drop it if it turns out not to fit. Then state "using \<skill\> to \<purpose\>" and follow it strictly; a checklist becomes one todo per item.

**Process skills come first when several apply.** They set the approach; implementation and domain skills carry it out.

**Before asking the user anything, look it up** — the base branch is `git merge-base`, whether CI exists is `ls .github/workflows`. [asking-users.md](references/asking-users.md) owns that rule and the two gates below it.

## Which door you come in by

**This is the only routing decision you make.** From there each stage names its own next hop and the condition that picks it.

| The request | Enter at |
|---|---|
| Something should behave differently — a feature, a change, UI | `brainstorming` |
| Something is broken — a bug, a failing test or build, a regression, a flaky fault | `systematic-debugging` |
| The project has no constraints of its own — no AGENTS.md, no guardrails, the same class of mistake recurring | `init`, which is not on the chain and returns to it |

**A branch never comes off, on any path.**

## What every round owes, whatever its size

**Three things never come off, at any size: `test-driven-development` in full, the evidence bar — a command, an exit code and an observation — and final isolation: [two static reviews](../executing-plans/SKILL.md#wrap-up-two-static-reviews-at-once), then a [fresh runtime verifier](../executing-plans/SKILL.md#runtime-verification-a-fresh-third-subagent).** Those final dispatches are mandatory even in `inline` mode ([dispatching.md](references/dispatching.md) carries the rest).

**You rule it finished, not any reviewer or verifier.**

## Red Flags — stop when you catch yourself thinking these

| Thought | Reality |
|------|------|
| "This one is simple, no need to check for a skill" | A question is a task too. Check first. |
| "Let me understand the code a bit first" | Checking for a skill comes before clarifying or exploring. |
| "I remember what that skill says" | Skills change. Open the current one. |
| "It is a small change, so I will just make it" | Small takes stages off against a criterion. It takes nothing off [the three standing obligations](#what-every-round-owes-whatever-its-size). |
| "It has grown past what I judged it against, but I am nearly done" | The judgement is against the change, not against how far in you are. |

Each skill carries the red flags for its own stage; these fire before any skill has been opened.

---
name: using-dev-kit
description: >-
  Use before writing code, running a command or asking the user a clarifying question — routes to the right dev-kit skill, or to none of them.
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

# Using dev-kit

## The rule

**Route before you start** — before writing code, running commands, even before asking a clarifying question. Invoke the door you picked as `dev-kit:<skill-name>`, state "using \<skill\> to \<purpose\>", and follow it strictly; a checklist becomes one todo per item.

**Process skills come first when several apply.** They set the approach; implementation and domain skills carry it out.

**Before asking the user anything, look it up** — the base branch is `git merge-base`, whether CI exists is `ls .github/workflows`. [asking-users.md](references/asking-users.md) owns that rule.

## Which door you come in by

**This is the only routing decision you make.**

| The request | Where it goes |
|---|---|
| "Fix that typo" · "Add a log line here" · "Rename X to Y" — you already know what to change, where, and how you will check it | **No chain.** Say what you are about to do, then `test-driven-development` |
| "Add OAuth login" · "This list should be filterable" · "Make the export async" | `brainstorming` |
| "This test fails" · "The build errors" · "It 502s sometimes" | `systematic-debugging` |
| "There is no AGENTS.md" · "The same mistake keeps coming back" | `init`, which is not on the chain and returns to it |

Something turning out to be undecided — a second option, a boundary nobody has drawn — is a `brainstorming` round, whatever is already written.

**A branch never comes off, on any path.**

## Platform tools

Before dispatching or translating a named tool, identify the current harness from the tools it actually exposes and read exactly one mapping: [Codex](references/codex-tools.md), [Claude Code](references/claude-tools.md), or [Pi](references/pi-tools.md). Where the mapping says no native subagent exists, choose `inline`; an external process is not a native subagent.

What to hand a subagent, and what never to, is in [dispatching.md](references/dispatching.md).

---
name: using-dev-kit
description: >-
  Use before writing code, running a command or asking the user a clarifying question — routes to the right dev-kit skill, or to none of them.
---

<SUBAGENT-STOP>
If you were dispatched for a specific task, ignore this skill and execute only that task.
</SUBAGENT-STOP>

# Using dev-kit

## The rule

Route before acting. Invoke `dev-kit:<skill-name>`; choose the process skill first when several apply.

Before asking the user, apply [the three gates](references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong).

## Which door you come in by

| Request state | Route |
|---|---|
| Settled small change whose result, scope, location and verification are fixed and fits one session | Use `test-driven-development` for behaviour; otherwise run project checks |
| New or changed behaviour, UI or contract with an undecided requirement or boundary | `brainstorming` |
| Bug, failing test/build, regression or unexplained mismatch | `systematic-debugging` |
| Project constraints, contributor docs or recurring convention failures need establishing | `init` — independent of the development chain |

If any requirement or boundary is undecided, route to `brainstorming`. Never implement on `main` or `master`.

## Platform tools

Before dispatching, read the current-harness mapping: [Codex](references/codex-tools.md), [Claude Code](references/claude-tools.md), or [Pi](references/pi-tools.md).

[dispatching.md](references/dispatching.md) owns delegation. Only [`executing-plans`](../executing-plans/SKILL.md) may concurrently dispatch dependency-ready, write-disjoint implementation tasks; all other dispatch, including wrap-up, is serial.

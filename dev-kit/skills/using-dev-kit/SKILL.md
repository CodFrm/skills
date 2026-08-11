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

Route before acting. Invoke the selected door as `dev-kit:<skill-name>`, state "using \<skill\> to \<purpose\>", and follow it. When several skills apply, invoke the process skill first.

Before asking the user, apply [the three gates](references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong).

## Which door you come in by

| Request state | Route |
|---|---|
| Settled small change: observable result, scope, location and verification are fixed, and it fits one session | No brainstorming. Use `test-driven-development` for behaviour; otherwise run the applicable project checks |
| New or changed behaviour, UI or contract with an undecided requirement or boundary | `brainstorming` |
| Bug, failing test/build, regression or unexplained mismatch | `systematic-debugging` |
| Project constraints, contributor docs or recurring convention failures need establishing | `init` — independent of the development chain |

If any requirement or boundary is undecided, route to `brainstorming`. Implementation never runs directly on `main` or `master`.

## Platform tools

Before dispatching, read exactly one current-harness mapping: [Codex](references/codex-tools.md), [Claude Code](references/claude-tools.md), or [Pi](references/pi-tools.md). If it exposes no native subagent, choose "inline".

[dispatching.md](references/dispatching.md) owns what to delegate. Dispatch is serial; [`executing-plans`](../executing-plans/SKILL.md) owns the task and wrap-up sequence.

---
name: brainstorming
description: >-
  Use before implementing new or changed behaviour, UI or contracts when a requirement or boundary remains undecided, and again when an agreed one turns out wrong. Ends in a user-approved spec. Not for: a settled small change, factual Q&A or read-only investigation.
---

# Requirements exploration and specification (brainstorming)

## Hard gate

Do not write production code, tests, migrations or scaffolding until the user approves the written spec. Exploration may write only `.dev-kit/artifacts/<spec-slug>/mockups/`; after design agreement it may write the uncommitted `docs/specs/<spec-slug>.md` draft.

Design agreement and spec approval are separate gates. The first settles the direction section by section; the second requires the user to read the finished file and explicitly say no problem remains.

Write the spec and every later report in the user's language, unless the repository's contributor docs consistently use another language. Keep machine-facing tokens ASCII.

## Order

1. Read project instructions, relevant code/tests and recent related commits. Record verified facts, user statements and unknowns. Fix the slug now: `YYYY-MM-DD-<lowercase-short-name>`.
2. If the request contains independently shippable subsystems, propose the split and dependency order; continue with one spec.
3. Ask one question at a time only when the answer changes scope, observable behaviour, failure handling or acceptance. Apply [the three gates](../using-dev-kit/references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong).
4. Present 2–3 options, recommendation first, with user impact, cost, risk and trade-off. Remove extension points no current requirement needs.
5. Present the design in reviewable sections: flow, boundaries, state/data, failures/recovery and test seams. For visual decisions, apply [UI and HTML mockups](#ui-and-html-mockups) before asking for agreement.
6. Copy [spec-template.md](references/spec-template.md) to `docs/specs/<spec-slug>.md`, fill it from verified facts, run the [self-check](#self-check-before-the-gate), and ask what remains wrong. Revise that same uncommitted file until the user explicitly approves it.
7. Invoke [`using-git-worktrees`](../using-git-worktrees/SKILL.md). Move the final draft into the round workspace, commit it by path, install dependencies and run the baseline.
8. If the baseline changes a requirement or testing decision, revise the formal spec here, rerun the self-check, obtain approval again and commit only that revision. Otherwise choose the route under [What happens after the spec](#what-happens-after-the-spec).

No open question that changes the promised result may enter an approved spec.

## Only significant decisions go to the user

Take observable scope, flows, copy, failure behaviour, compatibility, privacy and permission boundaries to the user. Decide internal structure, naming and test organisation from repository evidence; record material choices and rejected options in the spec's design-decision table.

The main session owns user questions, split decisions, agreement gates and the spec file. It may dispatch read-only exploration, option drafts or mockup variants serially; it compares the returns itself.

## UI and HTML mockups

Build a mockup only when rendering will settle layout, density, hierarchy, states or responsive behaviour. State what it will decide, use the project's real tokens/components, and store it under `.dev-kit/artifacts/<spec-slug>/mockups/`. [mockups.md](references/mockups.md) owns the mechanism.

A mockup is local decision evidence, not implementation. Put every binding decision in spec prose; link the artifact as supporting evidence and mark it local/not in Git unless the repository already commits comparable images.

## Writing the spec

The committed spec is the only durable statement of what the round owes. It states observable requirements and non-goals, not implementation steps, commands, verdicts or an acceptance checklist. If code, tests or a report conflict with it, stop, revise the spec, obtain approval and commit the revision; never edit it merely to match implementation.

Every fact is verified, user-decided or explicitly unknown. Every requirement states a precondition, action and observable result. Testing decisions name the fewest high-value seams and what static review or runtime observation covers when automation is not feasible; confirm them with the user.

### File naming

Use `docs/specs/YYYY-MM-DD-<short-name>.md`. Keep that slug for the spec, plan, artifacts, verification directory, worktree and branch; never rename it during the round. Follow an existing project naming convention without bulk-renaming history. Formal specs never live under gitignored `.dev-kit/`.

### Required structure

Use [spec-template.md](references/spec-template.md) and delete unused instructions. Keep: objective; hard invariant; evidenced numbered problems; actors/user stories; numbered design decisions with rejected options; observable design prose covering owned flows, states, failures and relevant security/privacy/compatibility/accessibility; out of scope; confirmed testing decisions; relevant links; and no unresolved approval-blocking question.

Number problems and decisions, not requirements.

## Self-check before the gate

- [ ] Goal, actor, success outcome, scope, non-goals and owned failure paths are settled
- [ ] Every problem has evidence; every decision records its basis and rejected option
- [ ] No TBD, placeholder, contradiction, undefined term or unrequested capability remains
- [ ] Every requirement is observable and the testing seams were confirmed with the user
- [ ] Relevant compatibility, security, privacy, accessibility and UI states are explicit
- [ ] The spec is one shippable change; all links resolve; no credential or personal data appears

## Finish the draft, then commit it on the round branch

After explicit approval, record the draft's absolute path. In the round workspace, prove the destination is absent, then move rather than regenerate it:

```bash
mkdir -p docs/specs
test ! -e "docs/specs/<spec-slug>.md"
mv "<original-checkout>/docs/specs/<spec-slug>.md" "docs/specs/<spec-slug>.md"
git add docs/specs/<spec-slug>.md
git commit -m "docs: spec for <short name>"
```

Stop if the destination exists. Add only the spec path; never `git add -A`. If the dedicated branch is already the current checkout, commit the approved file there without moving it.

## What happens after the spec

The committed spec and baseline must already be in the isolated round workspace.

| Change shape | Next state |
|---|---|
| More than about three steps or spans sessions | [`writing-plans`](../writing-plans/SKILL.md) |
| Three steps or fewer in one session | One TDD slice, then [two static reviews](../executing-plans/SKILL.md#wrap-up-two-static-reviews), [runtime verification](../executing-plans/SKILL.md#runtime-verification-the-main-session-drives-it), and delivery |

Any newly undecided behaviour returns to this skill and must clear the same approval gate.

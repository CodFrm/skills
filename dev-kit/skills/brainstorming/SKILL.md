---
name: brainstorming
description: >-
  Use before a tracked change when behaviour, UI, contracts, scope or another requirement boundary remains undecided, and again when an agreement turns out wrong. Produces an approved spec. Not for settled small changes, factual Q&A or read-only investigation.
---

# Requirements exploration and specification (brainstorming)

## Gate and ownership

Do not write production code, tests, migrations or scaffolding until the user approves the written spec. Exploration may write only `.dev-kit/artifacts/<spec-slug>/mockups/`; after design agreement it may write the uncommitted `docs/specs/<spec-slug>.md` draft.

Design agreement settles the direction section by section. Spec approval requires the user to read the finished file and explicitly say no problem remains. No open question that changes the promised result may pass that gate.

The main session owns user questions, split decisions, both agreement gates and the spec. It may dispatch read-only exploration, option drafts or mockup variants serially, then compare the returns itself.

Use the user's language unless repository instructions require another; keep machine-facing tokens ASCII.

## Flow

1. Read project instructions, relevant code/tests and recent related commits. Separate verified facts, user statements and unknowns. Fix `YYYY-MM-DD-<lowercase-short-name>` for every round artifact.
2. If the request contains independently shippable subsystems, propose their split and dependency order; continue with one spec.
3. Ask one question at a time only when the answer changes scope, observable behaviour, failure handling or acceptance. Apply [the three gates](../using-dev-kit/references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong).
4. Present 2–3 options, recommendation first, with user impact, cost, risk and trade-off; add no unrequired extension point.
5. Present flow, boundaries, state/data, failures/recovery and test seams in reviewable sections. Use a [UI or HTML mockup](references/mockups.md) first when rendering will settle a visual decision.
6. Copy [spec-template.md](references/spec-template.md) to `docs/specs/<spec-slug>.md`; fill it from verified facts, remove unused instructions and run the self-check below. Revise the same uncommitted file until the user explicitly approves it.
7. Give the approved draft's absolute path to [`using-git-worktrees`](../using-git-worktrees/SKILL.md).
8. If the baseline changes a requirement or testing decision, revise the spec here, rerun the gate and commit only the approved revision. Otherwise enter [`writing-plans`](../writing-plans/SKILL.md).

## UI and HTML mockups

Take observable scope, flow, copy, failures, compatibility, privacy and permissions to the user; decide internals and test organisation from repository evidence. Record material choices and rejected options.

Use [mockups.md](references/mockups.md) only to decide layout, density, hierarchy, states or responsiveness. Put every binding result in the spec; mockups remain local evidence unless the repository commits comparable assets.

## Spec contract

The committed spec is the round's only durable statement of observable requirements and non-goals, with no implementation steps, commands, verdicts or acceptance checklist. On conflict, stop, revise and re-approve it; never conform it to implementation.

Mark every fact verified, user-decided or unknown. Each requirement identifies precondition, action and observable result. Confirm the smallest high-value automated seams and any wrap-up/runtime coverage with the user.

Use `docs/specs/<spec-slug>.md`; never rename the slug or store a formal spec under gitignored `.dev-kit/`. [spec-template.md](references/spec-template.md) owns its sections and fields.

## Self-check before approval

- [ ] Goal, actor, success outcome, scope, non-goals and owned failure paths are settled
- [ ] Every problem has evidence; every material decision has a basis and rejected option
- [ ] No placeholder, contradiction, undefined term or unrequested capability remains
- [ ] Requirements are observable and testing seams are user-confirmed
- [ ] Relevant compatibility, security, privacy, accessibility and UI states are explicit
- [ ] The spec is one shippable change; links resolve; no credential or personal data appears

Newly undecided behaviour returns here and clears both gates again.

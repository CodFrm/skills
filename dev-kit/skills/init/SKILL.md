---
name: init
description: >-
  Use when a project needs a missing or stale constraint system — contributor or agent guidance, engineering conventions, guardrails, verification, or a remedy for recurring convention failures.
---

# Project constraint initialisation (init)

```text
read-only scan → quantified recommendations → user selection
  → selected generation → self-verification → delivery note
```

Do not use it for one ordinary document, one direct lint-rule change, or day-to-day feature work.

- Scan writes nothing.
- Implement only recommendations the user selects.
- Overwrite an existing path only when the user selects `overwrite` for that path and `git status` shows it clean.
- Generate only project-specific content supported by repository evidence; omit unfillable sections and placeholders.
- Give each fact or rule one owning file; other files link to it.
- Call a convention `review-only` until a real gate and its guard test pass. State whether a passing guard blocks merge, runs only locally/pre-commit, or has no gate.

Use the user's language unless the repository's contributor documentation consistently establishes another one.

## 1. Scan without writing

Classify the repository using tracked file and commit counts. Run the minimal probe below; for an established repository, also follow [scanning-existing-projects.md](references/scanning-existing-projects.md).

Establish from tracked evidence the ecosystem and real command entry points; guidance and documentation; lint/type/format/test gates; UI/i18n; e2e/runtime verification; and observability. Record a count and representative `file:line` samples for each finding. Use one real command entry point per domain consistently.

Deep-scan dispatches are serial and read-only. Each returns a count, the first three `file:line` samples, and one conclusion; the main session compares and prioritizes them.

## 2. Recommend, ask, and stop

Give a short verdict and one row per actionable finding:

| Priority | Recommendation | Quantified evidence | Cost |
|---|---|---|---|
| P0/P1/P2 | `<specific action>` | `<count + representative file:line>` | `<effort and migration cost>` |
| — | Not recommended: `<candidate>` | `<why it is unnecessary now>` | — |

Order proven recurring failures before cheap lock-in, breached conventions, structural gaps, and generic gaps. Keep raw findings out of the report.

Apply these question gates in order:

| # | Criterion | Action | Evidence kept |
|---|---|---|---|
| 1 | Findable in repo/environment | Look it up; do not ask | command/output or `file:line` |
| 2 | Not findable; cheap to change if wrong and not user-observable | Decide, state the basis, continue | refutable basis |
| 3 | Wrong means user-visible rework, irreversible cost or project policy | Ask with options, recommendation and impact | user's words |

> This table is the standalone copy of [asking-users.md](../using-dev-kit/references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong). Change both copies together.

Ask which recommendation rows are in or out and, for an existing project, which findings are deliberate trade-offs. Ask anything else only when it changes selected work.

For every proposed output path that exists, present its shape and staleness, proposed disposition, and basis. Report uncommitted changes. Stop until the user selects recommendations and dispositions.

## 3. Generate the selection

Use one disposition per existing path:

| Disposition | Action |
|---|---|
| `overwrite` | Regenerate from verified facts, while carrying forward every project-specific rule the old file owned that templates cannot represent. |
| `merge` | Preserve existing wording, structure, and order; add only missing selected content. |
| `keep` | Do not change the file this round. |

Propose `merge` when unique project content or insufficient evidence prevents safe regeneration; otherwise propose `overwrite`. Project conventions win over templates; report conflicts at delivery.

The main session generates documents serially. Copy selected outputs from `templates/`, preserve target layout, rename template-only filenames, and remove template comments, unused sections, and unresolved placeholders. Follow [filling-templates.md](references/filling-templates.md) and [agents-md-authoring.md](references/agents-md-authoring.md).

For selected guardrails, follow [lint-harness.md](references/lint-harness.md) and the relevant [TypeScript](references/lint-recipes-ts.md) or [Go](references/lint-recipes-go.md) recipes. For selected e2e tracks, follow [e2e-harness.md](references/e2e-harness.md); keep committed smoke tests separate from authorized, gitignored real-environment verification.

Stop and return to selection if generation requires an unselected file, unverifiable project policy, external side effect, destructive action, or overwrite of a dirty path.

## 4. Verify

Fix failures before delivery. Run selected guard and guard-disable tests; every documented command; tracked path/symbol and relative-link/anchor checks; environment-example loading; selected smoke e2e; CI/pre-commit wiring checks; selected emitted-log checks; and the project's final verification command. Report the exact merge-blocking limitation.

Path/symbol and link checks may be serial read-only dispatches. The main session runs any experiment that mutates shared configuration.

## 5. Deliver

In at most 15 lines, report only what the diff cannot show:

- gate-2 decisions and their bases;
- selected work not completed and why;
- each guardrail's actual enforcement scope;
- established conventions that overrode templates;
- overwritten files and rules carried forward from their prior content.

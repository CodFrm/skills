---
name: init
description: >-
  Use when a project's constraints need establishing or filling in — development standards, engineering conventions, a contributor guide, AGENTS.md or CLAUDE.md, lint guardrails in CI, stale docs on an existing project — or when the agent keeps repeating the same class of mistake.
---

# Project constraint initialisation (init)

`init` is independent of the feature-development chain. It transitions through:

```text
read-only scan → diagnosis/recommendations → user selection
  → selected docs/guardrails/e2e → self-verification → delivery note
```

Use it for a missing or stale project constraint system or recurring convention failures. Do not invoke it for one ordinary document, one direct lint-rule change or day-to-day feature work.

Hard gates:

- Scan writes nothing.
- Implement only recommendations the user selects.
- Generate only files whose project-specific content can be verified; delete unfillable sections.
- Each fact/rule has one owning file. Link from every other layer.
- Documentation-only conventions remain `review-only`; call a guardrail enforced only after its real gate and guard test pass.

Generated content follows the user's language unless the repository's contributor docs consistently establish another one.

## Step 1 · Scan (read-only, no writing)

Classify the repository with tracked file/commit counts. New/small repositories run the minimal probe; established repositories also run [the complete deep scan](references/scanning-existing-projects.md).

The minimal probe must establish from repository evidence:

- ecosystem, package manager and real command entry points;
- existing AGENTS/CLAUDE/contributor docs and documentation set;
- lint/type/format/test configuration and CI/pre-commit gates;
- UI/design-system/i18n presence;
- e2e/runtime form and existing verification track;
- logging/metrics/tracing entry points.

Use `git grep`, `git ls-files` and `git ls-tree` for tracked facts. Use plain `ls` only for existence checks. Every finding carries a count plus representative `file:line` samples.

For an established repository, [scanning-existing-projects.md](references/scanning-existing-projects.md) owns the commands for project shape, constraint drift, duplicated concepts, recurring fixes, test value, e2e separation, merge gates and observability.

Dispatch deep-scan items only as serial read-only tasks with a fixed return: count, first three `file:line` samples, and one conclusion. The main session compares and prioritizes the results. This standalone flow has no plan-bound `parallel_evidence`, so it does not authorize concurrency.

Choose one real command entry point per domain: package-manager script, then Make target, then bare command. Reuse it in docs, pre-commit and CI.

## Step 2 · Produce the diagnosis and recommendations, then wait

Output a short verdict followed by one decision row per actionable finding:

| Priority | Recommendation | Quantified evidence | Cost |
|---|---|---|---|
| P0/P1/P2 | `<specific action>` | `<count + representative file:line>` | `<effort and migration cost>` |
| — | Not recommended: `<candidate>` | `<why current project does not need it>` | — |

Order recurring proven failures first, then zero-cost lock-in, breached established conventions, structural gaps and generic gaps. Do not dump raw scan output or repeat findings outside their recommendation row.

### B. Questions you need answered

Apply these gates in order:

| # | Criterion | Action | Evidence kept |
|---|---|---|---|
| 1 | Findable in repo/environment | Look it up; do not ask | command/output or `file:line` |
| 2 | Not findable; cheap to change if wrong and not user-observable | Decide, state the basis, continue | refutable basis |
| 3 | Wrong means user-visible rework, irreversible cost or project policy | Ask with options, recommendation and impact | user's words |

> This table is the standalone copy of [asking-users.md](../using-dev-kit/references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong). Change both copies together.

Always ask which recommendation rows are in/out. On an existing project, also ask which findings are deliberate trade-offs. Ask other questions only when their answers change selected work. Then stop; no project file changes before the user answers.

## Step 3 · Generate selected documents

| File | Owner | Generate when |
|---|---|---|
| `AGENTS.md`; `CLAUDE.md` | project facts/routing/principles/map; one-line Claude import | always |
| `docs/develop.md`; `docs/testing.md` | commands/process/enforced rules; test design | always |
| `docs/architecture.md` | layering, dependency direction, extension recipes | clear layering exists |
| `docs/verification.md`; report template | runtime verification flow; report/verdict/evidence form | drivable runtime exists |
| `docs/design.md` | project design system | UI exists |
| `docs/observability.md` | selected logging/metrics/tracing conventions | recommendation selected |
| `docs/documentation.md`; `docs/README.md` | maintenance/ownership; index | documentation set warrants them |
| `e2e/README.md`; `.env.example`; ignore entries | harness; real-target variables; local artifacts | selected e2e track needs them |

Copy only selected files from `templates/`, preserving their target layout. Rename `AGENTS.md.template`, `CLAUDE.md.template` and `env.example` at landing. Delete template comments, unused sections and unresolved placeholders.

The main session writes documents. If dispatch is necessary, do one document serially with explicit ownership.

### Fill the placeholders from project facts

Read [filling-templates.md](references/filling-templates.md). Every symbol, path, command and code shape must come from tracked project usage, or from a selected convention that was built and run before documentation. If neither exists, delete the section.

### Write AGENTS.md

Read [agents-md-authoring.md](references/agents-md-authoring.md). Keep only project facts, conditional routing, selected decidable principles on concrete repository seams, and a quick architecture map. Put methods in the owning docs.

## Step 4 · Pin selected guardrails

Read [lint-harness.md](references/lint-harness.md). It owns selection, escalation, exemptions, ratchets, pre-commit and the delivery contract. Ready-made implementations are in [TypeScript](references/lint-recipes-ts.md) and [Go](references/lint-recipes-go.md); other ecosystems use native tooling.

Each selected rule must have precise scope, sanctioned exemption, corrective diagnostic, a guard test through the real configuration in both directions, a real merge/local gate, documentation pointer and a green tree. Verify the guard by disabling it once and observing the guard test fail, then restore it.

## Step 5 · Build selected e2e tracks

Keep permanent smoke e2e under committed `e2e/` and one-off runtime verification under gitignored `e2e/scratch/`. Smoke uses mocked external dependencies and only stable core flows; scratch may use an authorized real environment.

Read [e2e-harness.md](references/e2e-harness.md) for two-configuration isolation, hermetic resources, protocol mocks, independent oracle, orchestration and driver choice. Use the repository's existing runtime/toolchain.

Ownership after generation:

- `docs/verification.md`: when/how to verify;
- `e2e/README.md`: harness setup, commands and isolation;
- `docs/references/verification-report-template.md`: report layout, verdicts and evidence.

Cross-link; do not copy rules between them.

## Step 6 · Self-verification

Run in order and fix failures before delivery:

1. Selected lint and guard tests, including the disable/red/restore check.
2. Every documented command.
3. Tracked-symbol/path fact checks from each generated document.
4. Relative-link and anchor checks.
5. `.env.example` loading, when generated.
6. At least one real smoke e2e, when generated.
7. CI/pre-commit wiring and the exact merge-blocking limitation.
8. One real emitted log matching the selected convention, when generated.
9. The project's final full verification command.

Items 3 and 4 may be serial read-only subagent tasks. Do not dispatch the guard-disable experiment; it mutates shared configuration.

## Step 7 · Delivery note

Under 15 lines, report only what the diff cannot show:

- gate-2 decisions made for the user and their basis;
- selected recommendations not completed and why;
- whether guardrails truly block merge, run only locally/pre-commit, or have no gate;
- existing-project conventions that overrode a template assumption.

## Fill-in mode

Preserve existing wording, structure and order. Add rather than overwrite. Follow project style. Where a template conflicts with an established convention, the project wins and the conflict appears in the delivery note. Never convert a deliberate trade-off before the user answers step 2.

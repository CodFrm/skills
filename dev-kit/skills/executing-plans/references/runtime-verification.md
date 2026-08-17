# Runtime verification

Derive verdicts from observed behaviour of the built target, never code, green tests or a stand-in. Read the spec, `docs/verification.md`, any e2e guide, and only what identifies how to start, reach and drive the target.

## Before running

- Require the report path gitignored, the working tree clean and HEAD exactly the reviewed SHA. On failure, report the blocker and write nothing.
- Record initial HEAD and plan SHA-256; recheck both and the clean tree at the end.
- Take evidence directory, isolation and oracle from project verification/e2e docs; otherwise use ignored `e2e/scratch/<spec-slug>/`. Reuse an existing harness.
- Author the cheapest form that observes the contract: nothing when an existing entry point reaches the target without depending on your own machine state, a launcher that stops at the target when reaching it needs a specific start or isolated state, a full script when the sequence must be replayed or timing is the contract.
- Write authored helpers and evidence only there; copy evidence while its run is alive.

## One verdict per spec requirement

| Verdict | Requires |
|---|---|
| `holds` | how it was driven, deciding evidence, and whether the dependency was real or an authorized substitute |
| `does not hold` | reached it and observed contrary behaviour |
| `not observed` | no decisive observation, with the gap or blocker |

An observed failure is never `not observed`. A self-chosen substitute proves nothing; a user-authorized one can reach `holds` only when the row names it and what it does not cover. Do not weaken checks, omit failures or soften verdicts.

## Boundaries

- Write only under scratch. Inventory build/runtime output; safely clean what this run created and report remainders.
- Do not edit production code, tracked tests/files, index, HEAD or branches. A non-hold is reported, not repaired here.
- Add no dependencies. Use credentials only through approved ignored mechanisms; redact secrets and personal data from all evidence.
- Isolate data/resources, stop started processes and report persistent side effects.

## Stop and ask

Ask the user about a requirement whose real dependency `.env` does not configure, or an effect outside the authorization list: deploy, shared/real migration, message send, mutating external call or charge. Containers, processes, documented startup commands, mocks and fixtures do not substitute for either.

The question that started this run already carried both for predicted gaps. For one found while driving, first finish every other requirement so one question covers all gaps. Name the service and absent variable names only, or the exact effect and target. [`executing-plans`](../SKILL.md#runtime-verification-the-main-session-drives-it) owns answer routing.

## The report

Write `report.md` in that directory as you work. Follow the project's report template when present; otherwise include:

- per-requirement verdict, and whether its dependency was real or an authorized substitute;
- ordered steps with how the target was driven, exit codes where the form produces them, and deciding evidence;
- every coverage gap, and per blocked service the absent variable names;
- created artifacts and cleanup state;
- initial/final HEAD, clean-tree output and plan checksum;
- shortest clean-checkout reproduction steps for the user.

After validating the report, accept automatically only when every requirement holds. Otherwise keep verification `reported` for the choice owned by [`executing-plans`](../SKILL.md#runtime-verification-the-main-session-drives-it). Never repair or start a correction round here.

# Runtime verification

Verdicts come from observed behaviour of the built target, never from code, green tests or a stand-in for the target itself. Read the spec completely, plus `docs/verification.md` and the e2e guide when present, then read whatever identifies how to start, reach and drive the target — and stop there. Judging and fixing the implementation belonged to the two wrap-up axes.

## Before running

- Require the report path gitignored, the working tree clean and HEAD exactly the reviewed SHA. On failure, report the blocker and write nothing.
- Record initial HEAD and SHA-256 of the plan. Recheck both plus clean-tree output at the end.
- Take the evidence directory, isolation and oracle from the project's verification and e2e docs; where they say nothing, use an ignored `e2e/scratch/<spec-slug>/`. Reuse whatever harness exists instead of building one.
- Author the cheapest form that observes the contract: nothing when an existing entry point reaches the target without depending on your own machine state, a launcher that stops at the target when reaching it needs a specific start or isolated state, a full script when the sequence must be replayed or timing is the contract.
- Write whatever you author, and every piece of evidence, only in that directory, copying evidence there while the run that produced it is still alive.

## One verdict per spec requirement

| Verdict | Requires |
|---|---|
| `holds` | how it was driven, deciding evidence, and whether the dependency was real or an authorized substitute |
| `does not hold` | reached it and observed contrary behaviour |
| `not observed` | no decisive observation, with the gap or blocker |

An observed failure is never `not observed`. A substitute you chose yourself proves nothing; one the user authorized can reach `holds` when the verdict row names what stood in and what it does not cover. Do not weaken checks, omit failures or soften verdicts.

## Boundaries

- Deliberate writes only under scratch. Inventory disposable build/runtime output; clean safe output created by this run and report every remainder.
- Do not edit production code, tracked tests/files, index, HEAD or branches. A non-hold is reported, not repaired here.
- Add no dependencies. Use credentials only through approved ignored mechanisms; redact secrets and personal data from commands, logs, payloads and images.
- Isolate data/resources, stop started processes and report persistent side effects.

## Stop and ask

Two things are the user's to answer, never yours to arrange around: a requirement whose real dependency `.env` does not configure, and an effect outside the authorization list — deploy, shared or real migration, message send, mutating external call, charge. No container, service process, system service, documented start-up command, mock or fixture substitutes for either.

The question that started this run already carried both for everything the spec and `.env` predicted. For one that only surfaces while driving, carry every other requirement to a verdict first, so one round of questions covers them all. Name the service and the absent variable names — names only, never values — or the exact effect and what it touches. [`executing-plans`](../SKILL.md#runtime-verification-the-main-session-drives-it) owns what each answer changes.

## The report

Write `report.md` in that directory as you work. Follow the project's report template when present; otherwise include:

- per-requirement verdict, and whether its dependency was real or an authorized substitute;
- ordered steps with how the target was driven, exit codes where the form produces them, and deciding evidence;
- every coverage gap, and per blocked service the absent variable names;
- created artifacts and cleanup state;
- initial/final HEAD, clean-tree output and plan checksum;
- shortest clean-checkout reproduction steps for the user.

After validating the report, accept automatically only when every requirement holds. Otherwise keep
verification `reported` and let the user choose whether to accept the findings, provide/authorize
missing real input, or request a separate correction round. Never repair or start that round here.

<!-- Copy into the scenario directory verification.md names, as report.md, before running. Delete unused sections and this comment. -->

# Local verification: <scenario>

## Mode

`verifying a change` | `reproducing a bug`

## Goal / problem

<Expected observable behaviour and risk, or Expected/Actual bug statement>.

## Verdict

<!-- Fill last. Keep verdicts only here. For spec acceptance, one row per requirement. Where `not observed` came from unconfigured environment, "How observed" names the service and the absent variable names, never values. -->

| # | Requirement / bug claim | Verdict | Real / substituted | How observed | Check it yourself |
|---|---|---|---|---|---|
| V1 | `<verbatim requirement>` | holds / does not hold / not observed | real, or `substituted: <what stood in> — <what it does not cover>` | `<runtime observation>` | `<command, or launch command plus steps>` |

Summary: <what holds, deciding observation, every not-observed/failed item and shipping implication>.

## Authorization

<!-- Keep only when a real dependency was substituted or an external effect was authorized. -->

| # | Substitute or effect | The user's authorization, verbatim |
|---|---|---|
| V1 | `<what stood in for what, or the effect and what it touches>` | `<sentence>` |

## Reproduction steps

<!-- Keep for bug reproduction. -->

1. `<clean-checkout-to-observation steps>`

## Acceptance evidence

<!-- Keep for spec acceptance. One section per V row; do not repeat verdict labels. -->

### V1 · `<requirement>`

```console
$ <command>   # cwd and relevant redacted environment
<deciding lines>
$ echo $?
0
```

<What this proves>. Full output: `logs/<file>`.

<!-- UI only; use paired annotated images for before/after or light/dark. -->

| Before | After |
|---|---|
| `<screenshots/v1-before.png with annotation>` | `<screenshots/v1-after.png with annotation>` |

## Evidence index

- Commands/logs: `<inline deciding output plus optional full-file links>`
- Resources/data snapshots: `<paths and what each proves>`
- Screenshots/video: `<UI only; video includes decisive stills>`

## Persistent data changes

<!-- Keep only when authorized persistent data changed. -->

| Change | Forward | Backward/backup | Before/after query |
|---|---|---|---|
| `<scope/blast radius>` | `<command/exit>` | `<command/exit or irreversible plan>` | `<evidence>` |

Dataset: `<source, size and representative edge values>`. Compatibility window: `<old/new readers>`.

## Execution record

| Step | Status | Evidence/blocker |
|---|---|---|
| `<step>` | pending / passed / failed / blocked | `<path or observation>` |

## Integrity and cleanup

- Initial/final HEAD: `<sha>` / `<sha>`
- Initial/final plan checksum: `<sha256>` / `<sha256>`
- Final `git status --porcelain=v1`: `<output>`
- Created artifacts/processes/external data and cleanup: `<inventory>`
- Redaction performed: `<what was removed>`

## Evidence rules

- Every `holds` names how the target was driven — command, or launch command plus steps — and the deciding observation; failures are `does not hold`, unreached checks are `not observed`.
- Where a requirement changes state beyond the driven surface, that observation is an independent read with its own command and exit code.
- Embed decisive text/images inline. Link only large/binary/full captures and state what they contain.
- Use request/status/key fields for APIs; structured logs plus before/after data for async work; commands/stdout/stderr for CLI.
- Keep failed/unchecked steps visible. Redact secrets, credentials and personal data before saving.

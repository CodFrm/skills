# <feature name>

<!-- File: docs/specs/YYYY-MM-DD-<lowercase-kebab-name>.md. Delete instructions and unused sections. -->

> Status: Draft | Approved | Superseded
> Owner: <role or team; no personal data>
> Last updated: YYYY-MM-DD

**Objective:** <one observable purpose sentence>.

**Hard invariant:** <what must not regress, or "none beyond the project's existing gates">.

## Problem

1. **<problem>.** <impact and evidence: file:line, command/output, observed session or user report>.

## Actors and user stories

1. As a `<actor>`, I want `<capability>`, so that `<benefit>`.

## Design decisions

| # | Decision | Basis and rejected option |
|---|---|---|
| 1 | `<choice>` | `<basis>`. Rejected: `<alternative>` — `<why>` |

## <change-specific design sections>

Write requirements as design prose under headings from this change. Each requirement names its precondition, action, observable result and owned failure behaviour. Cover applicable flow/state/contracts/UI/security/privacy/compatibility/accessibility without file-path implementation detail or a duplicate acceptance checklist.

Reference local mockups as supporting evidence only; put binding decisions in prose.

## Out of scope

- `<excluded behaviour and destination, if any>`

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| `<user-visible/public/module boundary>` | `<owned behaviour>` | `<existing test or none>` |

State what cannot be automated and which static review or runtime observation covers it.

## Open questions

<!-- Must be empty before approval. -->

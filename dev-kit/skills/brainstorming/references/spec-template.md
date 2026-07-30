# <feature name>

<!-- The file name is docs/specs/<spec-slug>.md, where slug = the creation date + a lowercase
     kebab short name, e.g. 2026-07-27-oauth-login.md. It is not renamed once created — the
     mockup directory and every later evidence directory reference it. -->

> Status: Draft | Approved | Superseded
> Owner: <role or team; do not write personal details>
> Last updated: YYYY-MM-DD

**Objective:** one sentence — what this change is for.

**Hard invariant:** one sentence — what must not regress, whatever else changes. This is the line a
reviewer holds the implementation against when everything else is negotiable. When nothing is at
risk, write "none beyond the project's existing gates" rather than deleting the line.

## Problem

Numbered, and **each one has to point at its evidence** — a file and line, a command and its output,
a real observed session, a user report. A problem nobody can locate is a preference.

**Evidence comes in two strengths.** Something that went wrong and was observed — an error, a commit
that had to clean it up, a session, a user report — is the strong kind. A document stating that the
thing is missing is the weak kind: it proves the gap was acknowledged, not that it cost anything. Use
the strong kind where it exists, and **where only the weak kind does, say so in the entry.**

1. **<the problem in one bold phrase>.** What is wrong now, where it shows, and what it costs.
2. …

## Actors and user stories

1. As a `<actor>`, I want `<capability>`, so that `<benefit>`.

## Design decisions

Numbered, because **a decision is what gets contested later** — an argument three weeks from now needs
to name the row it disagrees with. The rejected options go in the same row as the decision that beat
them; a decision whose alternatives are not written down reads as the only thing anyone thought of.

Include the ones **you took yourself without the user's sign-off** (library choice, layering, naming) —
those are exactly the ones with no other record.

**A row is one or two sentences, and the argument is made exactly once.** Where a section below
develops the same reasoning, the row names the decision and what it beat and **points at that
section**.

| # | Decision | Why (and what was rejected) |
|---|---|---|
| 1 | `<what was chosen>` | `<the reasoning, or a pointer to the section that carries it>`. Rejected: `<the alternative>` — `<why it lost>` |

## <the change itself — section headings in its own vocabulary>

The requirements live here, as design prose. There is no fixed heading and no numbering: name the
sections after the parts of *this* change (`The fix loop`, `Directory layout`, `The retry window`),
the way you would explain it to someone who has to build it.

**This spec does not carry a checklist, and each requirement has to be written so that someone could
build one from it.** State the behaviour as something observable — what is true afterwards, under
which precondition, and what the failure looks like — not as "works properly" or "handles the edge
cases". Turning that into commands and verdicts belongs to the round that implements it.

What has to be covered somewhere in here, in whatever shape fits:

- **The user flow** — the main path, the empty states, and the error and recovery paths, in the order
  a user actually experiences them.
- **State, contracts and failure semantics** — stable interfaces, state transitions, permission
  boundaries, what happens on each failure. Avoid file paths, which drift.
- **UI and interaction**, when there is any — layout hierarchy, states, interactions and constraints
  **in prose**, plus keyboard, focus, screen-reader, narrow-viewport, theme and motion constraints.
  Reference the prototype (`.dev-kit/artifacts/<spec-slug>/mockups/index.html`, **a local artifact,
  not in Git**) as supporting evidence only, and say which parts of it are merely indicative — a
  reviewer cannot open a directory on your machine, so anything decisive has to be readable here
  without it.
- **Security, privacy, compatibility and accessibility** — sensitive data, log and report redaction,
  permissions, old-client behaviour, migration and rollback. State the reason where one does not apply
  rather than leaving it out silently.

## Out of scope

- `<what is deliberately not being done, and where it goes instead if anywhere>`

## Testing decisions

**Prefer the seams that already exist, and use the highest one that can observe the behaviour.**
A new seam is proposed at the highest point it can sit. **Confirm this table with the user** —
agreeing the seams up front is how the testing effort lands on the critical paths instead of on
every edge case.

| Seam | What it verifies | Prior art |
|---|---|---|
| `<user-observable boundary / public API / module interface>` | `<which part of the change>` | `<a similar existing test, or "none">` |

State the deliberate trade-offs plainly: what is **not** automatable and will be verified by review
instead, what is covered only indirectly, and where a green result would not mean much. Writing
"verified by review" is honest; inventing an assertion so a row looks automated is not.

## Open questions

Must be empty in the Approved state. Implementation must not begin while a question remains that would
change what "done" means.

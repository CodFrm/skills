<!--
Template: docs/README.md
Usage: copy into the project's docs/, delete the rows for documents you did not generate, and
delete this comment block at the end.
When adding, renaming or deleting any document, update this index and documentation.md's
ownership table at the same time.
-->

# Documentation index

The complete documentation set for contributors and AI coding agents. **Read [`../AGENTS.md`](../AGENTS.md) before starting** — it holds the engineering principles and a routing table of "when to read what".

| Document | What it owns | When to read it |
| --- | --- | --- |
| [`develop.md`](./develop.md) | Commands, directory structure, code style, the commit and PR flow | Before writing any code |
| [`architecture.md`](./architecture.md) | Layering, dependency direction, subsystems, "how to add an X" | When a change crosses a module boundary |
| [`testing.md`](./testing.md) | How tests are designed, what to write and what not to, how to run them | Before writing, changing or deleting any test |
| [`verification.md`](./verification.md) | One-off scratch verification and human-readable reports | When confirming a feature really works, or reproducing a bug |
| [`design.md`](./design.md) | The design system: tokens, components, theming, motion, states, where explanation lives, the new-page recipe | Before creating or modifying any interface |
| [`observability.md`](./observability.md) | Log levels and where to instrument, metrics, traces, and how to use them to investigate | When adding logs/metrics to a critical path, or investigating with them |
| [`documentation.md`](./documentation.md) | Documentation organisation rules and fact-checking discipline | Before changing any contributor documentation |

`references/` holds detail the main documents cannot carry, referenced by the corresponding main document:

| Reference | Belongs to |
| --- | --- |
| [`references/verification-report-template.md`](./references/verification-report-template.md) | [`verification.md`](./verification.md) |

<!-- Keep when the project writes specs under docs/specs/ -->
`specs/` is **not** part of this set: one file per requirement, recording what was agreed on the day it was written. It is append-only, it is not indexed here, and the fact-checking discipline in [`documentation.md`](./documentation.md#docsspecs-is-a-record-not-part-of-this-set) does not apply to it — a stale symbol in an old spec is history, not drift.

> To discover the real current documentation set (rather than trusting this table alone), run `git ls-files '*.md'`.

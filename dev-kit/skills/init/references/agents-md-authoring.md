# How to write AGENTS.md

Use [`../templates/AGENTS.md.template`](../templates/AGENTS.md.template); source project facts through [filling-templates.md](filling-templates.md).

AGENTS.md owns:

1. verified project facts;
2. a conditional routing table;
3. selected non-negotiable engineering principles;
4. a quick architecture map linking to the detailed owner.

Each route states its trigger, target document, and that document's ownership. Put methods in the target.

Keep a principle only when it is:

- decidable;
- tied to a concrete repository seam/path/interface;
- supported by a non-obvious reason;
- tagged `enforced by <gate>` only after that gate is verified, otherwise `review-only`.

Keep only user-selected or scan-supported principles, written in project vocabulary.

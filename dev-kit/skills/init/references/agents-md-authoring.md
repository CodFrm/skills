# How to write AGENTS.md

Use [`../templates/AGENTS.md.template`](../templates/AGENTS.md.template); source project facts through [filling-templates.md](filling-templates.md).

AGENTS.md owns only:

1. verified project facts;
2. a conditional routing table;
3. selected non-negotiable engineering principles;
4. a quick architecture map linking to the detailed owner.

Each routing entry states when it triggers, which document to read and what that document owns. Put methods in the target document, not AGENTS.md.

Keep a principle only when it is:

- decidable;
- tied to a concrete repository seam/path/interface;
- supported by a non-obvious reason;
- tagged `enforced by <gate>` only after that gate is verified, otherwise `review-only`.

Select only principles requested by the user or supported by the scan. Rewrite them in the project's vocabulary; delete generic/template entries.

## Self-check

- [ ] Every route has trigger, document and ownership
- [ ] Every principle passes all four gates above
- [ ] Every enforced claim names a real verified check and exemption policy
- [ ] Every stack/module/version fact is findable in tracked project files
- [ ] Method detail is linked, not duplicated

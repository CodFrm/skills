# How to write AGENTS.md

> Referenced by `SKILL.md` step 3. Read this before generating or adding to `AGENTS.md`.
>
> The template is at `../templates/AGENTS.md.template`; sourcing the placeholders is in [`filling-templates.md`](./filling-templates.md).

## AGENTS.md's hard rules

**It holds only four things**, with everything else sinking into `docs/`:

1. **Project facts** — stack, module paths, package manager, output. Objective, verifiable with `git grep`.
2. **The must-read routing table** — the most important part of the file.
3. **Non-negotiable engineering principles** — every one decidable.
4. **A quick architecture map** — one diagram plus a few lines, linking to `docs/architecture.md`.

**Write the routing table as conditional routing** — "**when** → read **which document** → what it **owns**" — not as a list of documents: an agent skips a list, but not a route.

```markdown
> **Before writing any code, read [`docs/develop.md`](docs/develop.md)** — the development
> standards: commands, directory structure, code style, the test mechanism, the commit flow.
> This file keeps only the non-negotiable principles and the architecture map.

> **Before creating or modifying any page, dialog or section, read
> [`docs/design.md`](docs/design.md)** — the design system: colour tokens, the component
> palette, layout/motion/state patterns, the new-page recipe. **Its Core Constraints apply to
> every UI change, not just new ones.**

> **To confirm a feature really works, read [`docs/verification.md`](docs/verification.md)** —
> driving the real application end to end with a one-off scratch script.
```

Every route needs **the trigger** + **the target document** + **what it owns** (one sentence) + **a scope reminder** where needed ("not just new ones").

## How to write engineering principles

Every entry passes three gates; anything that does not is left out:

| Gate | Bad | Good |
|---|---|---|
| **Decidable** | "Code should be elegant", "mind performance" | "Leave no `// removed` markers, just delete" |
| **Lands on a concrete extension point in this repository** | "Follow OCP" | "A new asset type → implement `AssetTypeHandler` and `Register()` it in `init()`; **do not `switch` on a type string in shared code**" |
| **Carries a why** | "Do not refactor in passing" | "Do not refactor in passing — it drowns the real change and breaks `git bisect`" |

Where a mechanical check exists, note it at the end of the entry:

> *The mechanically checkable part has been enforced by `<check name>` since `<date>` (running inside `<command>`); the exemption list **only shrinks**.*

**Tag every principle "enforced by `<gate>`" or "review-only".** The review-only column is the **standing pool of guardrail candidates** — next time someone violates one, pin it.

## High-value principle list

Draw on it per project; do not copy it wholesale. The ones the user asked for must be there; pick the rest by the project's situation, **preferring few and accurate over many and hollow**:

- **TDD/BDD first** — the failing test before any change to observable behaviour, the behaviour described as `Given/When/Then` or `describe/it`. The two exceptions live in `docs/testing.md` and are **not a blanket rule by file category**.
- **Confirm the bug exists, then fix** — reproduce it first, **with a failure reason matching the report**; where you cannot, say so and stop rather than fixing a hallucinated bug.
- **Fix the root cause, do not patch** — no guard at the consumer to paper over a bad value from the producer; normalise once at the boundary rather than repeatedly at call sites.
- **Scope discipline** — one change touches the producer + its tests + at most one drive-by drift fix. **Banned**: smuggled-in refactors, rename sweeps, formatting, import reordering, unrelated test changes. Unrelated mess gets **reported, not fixed in passing**.
- **Reuse first** — grep for an existing component/hook/utility before writing one. Decidable heuristics: importing both a primitive and a store ≈ you are rebuilding something; copying more than 10 lines → extract it; the same fix in two similar blocks → **the second is a bug, delete it and call the first**.
- **Direct replacement beats an adapter sandwich** — when swapping a backend or library, replace in place; no `interface Foo + LegacyImpl + NewImpl` unless both genuinely coexist at runtime.
- **Delete until it reads as though it were never written** — no dead code, no deletion placeholders, no config entries, fixtures or helpers that exist only for it, and none of the doc paragraphs, index entries or directory-tree lines pointing at it. Git remembers. The criterion is mechanical: **`git grep -inw` the bare word of the removed identifier across the whole repository**, rather than searching for the sentence you remember writing — leftovers hide in one-line lists and "covers A, B and C" summaries. See `docs/documentation.md`'s Deletion section.
- **SOLID / high cohesion, low coupling** — landed on a concrete seam in this repository, not textbook definitions.
- **No defensive code** — validate at boundaries only (external input, IPC, plugin hosts); internal calls trust each other. Do not swallow errors (`catch { return default }` masks failure and propagates dirty state). Do not double-fallback a user-configurable field (`value || "default"` overrides a deliberate empty value). Once a migration has run, delete the field rather than leaving a runtime shim.
- **Before adding a dependency, ask whether what exists can do it** — a permanent maintenance and security burden. When one is genuinely needed: lockfile committed, one package manager only (enforced via `preinstall` where possible), and the PR explains why the existing approach was insufficient.
- **Credentials and sensitive data stay out of the repository, the logs and the reports.** Secrets in `.env` (already gitignored) or a secret manager; redact before pasting anywhere. <Projects with a privacy boundary state their data red lines here.>
- **Observability: critical paths must be visible** — <external calls / state changes / permission decisions / failure degradations> emit structured logs with a correlation id. Details in `docs/observability.md`.
- **Read the corresponding document before starting** — carried by the routing table; one line here is enough.

## Self-check

- [ ] Does every routing entry carry all three elements — when + read what + what it owns?
- [ ] Is every principle decidable, landed on a concrete extension point here, and carrying a why?
- [ ] Is every principle tagged "enforced by `<gate>`" or "review-only"?
- [ ] For anything tagged "enforced", **has that guardrail really landed and been verified**? (If not, tag it review-only)
- [ ] Is every project fact (stack, module path, commands) findable with `git grep`?
- [ ] Did any "how to" detail get written in here? (Those belong to `docs/`; only a link stays)

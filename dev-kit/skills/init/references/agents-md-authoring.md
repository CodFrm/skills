# How to write AGENTS.md

> Referenced by `SKILL.md` step 3. Read this file before generating or adding to `AGENTS.md`.
>
> The template is at `../templates/AGENTS.md.template`; how to source the placeholders from the project is in [`filling-templates.md`](./filling-templates.md).

### AGENTS.md's hard rules

**It holds only four things**, with everything else sinking into `docs/`:

1. **Project facts** — the stack, module paths, package manager, output. Objective facts verifiable with `git grep`.
2. **The must-read routing table** — see below; this is the most important part of AGENTS.md.
3. **Non-negotiable engineering principles** — every one decidable, see below.
4. **A quick architecture map** — one diagram + a few lines, linking to `docs/architecture.md` for depth.

**How to write the routing table.** Write it as conditional routing — "**when** → read **which document** → what it **owns**" — not as a list of documents; an agent skips a list, but not a route:

```markdown
> **Before writing any code, read [`docs/develop.md`](docs/develop.md)** — the development
> standards: commands, directory structure, code style, the test mechanism, the commit flow.
> This file keeps only the non-negotiable principles and the architecture map; the concrete
> "how" is in that document.

> **Before creating or modifying any page, dialog or section, read
> [`docs/design.md`](docs/design.md)** — the design system: colour tokens, the component
> palette, layout/motion/state patterns, the new-page recipe. **Its Core Constraints apply to
> every UI change, not just new ones.**

> **To confirm a feature really works, read [`docs/verification.md`](docs/verification.md)** —
> driving the real application end to end with a one-off scratch script (not the test suite
> that gets committed to the repository).
```

Every route needs: **the trigger** (when) + **the target document** + **what it owns** (one sentence) + **a scope reminder** where needed (such as "not just new ones").

### How to write engineering principles

Every entry passes these three gates, and anything that does not is left out:

| Gate | Bad | Good |
|---|---|---|
| **Decidable** | "Code should be elegant", "mind performance" | "Leave no `// removed` markers, just delete" |
| **Lands on a concrete extension point in this repository** | "Follow OCP" | "A new asset type → implement `AssetTypeHandler` and `Register()` it in `init()`; **do not `switch` on a type string in shared code**" |
| **Carries a why** | "Do not refactor in passing" | "Do not refactor in passing — it drowns the real change and breaks `git bisect`" |

Where a mechanical check already exists, **note it at the end of the entry**, in this format:

> *The mechanically checkable part has been enforced by `<check name>` since `<date>` (running inside `<command>`); the exemption list **only shrinks**.*

### High-value principle list (draw on it per project; do not copy it wholesale)

The ones the user explicitly asked for must be there; pick the rest according to the project's actual situation, **preferring few and accurate over many and hollow**:

- **TDD/BDD first** — write the failing test before changing observable behaviour, describing the behaviour with `Given/When/Then` or `describe/it`. The two exceptions (a genuinely behaviour-preserving refactor, automation genuinely not being feasible) go into `docs/testing.md`, and are **not a blanket rule by file category**.
- **Confirm the bug exists, then fix** — reproduce it first, **with a failure reason matching the report**; if you cannot reproduce it, say so plainly and stop rather than fixing a hallucinated bug.
- **Fix the root cause, do not patch** — do not add a guard at the consumer to paper over a bad value from the producer; do not normalise the same field repeatedly at several call sites, normalise once at the boundary.
- **Scope discipline** — one change touches the producer + its tests + at most one drive-by drift fix. **Banned**: smuggled-in refactors / rename sweeps / formatting / import reordering / unrelated test changes. When you see unrelated mess, **report it and ask; do not fix it in passing**.
- **Reuse first** — grep for an existing one before writing a new component/hook/utility. With a decidable heuristic: importing both a primitive and a store ≈ you are rebuilding something; copying more than 10 lines → extract it; the same fix appearing in two similar blocks → **the second one is a bug; delete it and call the first**.
- **Direct replacement beats an adapter sandwich** — when swapping a backend or a library, replace in place; **do not** build `interface Foo + LegacyImpl + NewImpl` unless the two genuinely have to coexist at runtime.
- **Delete until it reads as though it were never written** — no dead code, no deletion placeholders, and no config entries, test fixtures or helper functions that exist only for it, nor the paragraphs, index entries and directory-tree lines in the docs that point at it. Git remembers; no monument needed. The criterion is mechanical: **take the bare word of the removed identifier / command / concept and `git grep -inw` the whole repository**, rather than searching for the sentence you remember writing — leftovers love to hide where you cannot recall writing them (slash-separated one-line lists, "covers A, B and C" summaries). See the "Deletion" section of `docs/documentation.md`.
- **SOLID / high cohesion, low coupling** — must land on a concrete seam in this repository (see the table above), rather than copying textbook definitions.
- **No defensive code** — validate at boundaries only (external input, IPC, plugin hosts); internal calls trust each other. Do not swallow errors (`catch { return default }` masks failure and propagates dirty state). Do not double-fallback a user-configurable field (`value || "default"` overrides a deliberate empty value from the user). Once a migration has run, delete the field; leave no runtime compatibility shim.
- **Before adding a dependency, ask whether what exists can do it** — a new dependency is a permanent maintenance and security burden. When one genuinely is needed: the lockfile must be committed, one package manager only (enforced with something like `preinstall` where possible), and the PR explains why the existing approach was insufficient.
- **Credentials and sensitive data stay out of the repository, the logs and the reports.** Secrets go in `.env` (already gitignored) or a secret manager; redact logs and verification reports before pasting them anywhere. <Projects with a privacy boundary state their specific data red lines here.>
- **Observability: critical paths must be visible** — <external calls / state changes / permission decisions / failure degradations> must emit structured logs with a correlation id. Details in `docs/observability.md`.
- **Read the corresponding document before starting** — carried by the routing table; one line in the principles is enough.

**Tag every principle: "enforced by `<gate>`" or "review-only".** That review-only column is the **standing pool of guardrail candidates** — next time someone violates one, take it out of the pool and pin it.

---

## Self-check

The generated `AGENTS.md` has to be able to answer:

- [ ] Does every routing entry carry all three elements — when + read what + what it owns?
- [ ] Is every principle decidable, landed on a concrete extension point in this repository, and carrying a why?
- [ ] Is every principle tagged "enforced by `<gate>`" or "review-only"?
- [ ] For anything tagged "enforced", **has that guardrail really landed and been verified**? (If not, it should be tagged review-only)
- [ ] Is every project fact (stack, module path, commands) findable with `git grep`?
- [ ] Did any "how to" detail get written in here? (Those belong to `docs/`; only a link stays here)

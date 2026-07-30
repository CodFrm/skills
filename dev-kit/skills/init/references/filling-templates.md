# How to fill the placeholders: gather the real facts first, then write the document

> Every `<angle bracket>` in a template is **a fact that must be sourced from the project**. This file is how to source them.

**The rule: every symbol name, path, command and code shape appearing in the docs must be findable with `git grep` on this branch.** The easiest accident is not leaving something unfilled, it is filling in something plausible that is not how this project writes it — **a wrong example in an authoritative voice**, which agents copy:

```go
// ❌ An invented generic shape — the project has no log.Info entry point at all
log.Info("connect success", "target_id", id)

// ✅ The real usage, lifted from the project's existing code
logger.Ctx(ctx).Info("client.Connect: connected",
    zap.String("target_id", id), zap.Duration("cost", cost))
```

## The three-step method

**① Locate the real source** — what the **single entry point** for this concept is, and where it lives.

**② Lift real usage from the project** rather than writing your own:

```bash
git grep -n "logger.Ctx" -- internal/ | head -20
```

Pick **the call that covers the convention's key points** (carries ctx, structured fields, the prefix), not the shortest one. Simplify the irrelevant parts when lifting it, but **not one character of the call shape changes**. **Where the project has no correct usage yet** — the convention is being introduced this round — write a minimal example and **actually compile / run it once** first.

**③ Verify each symbol and path is findable:**

```bash
git grep -n "logger.Ctx" -- internal/ >/dev/null && echo ok || echo "the doc is lying"
git ls-files --error-unmatch src/components/ui/ >/dev/null 2>&1 && echo ok || echo "path does not exist"
```

**Use git-aware commands** (`git grep` / `git ls-files`), not `rg` / `ls` — the latter match uncommitted files, so your local experimental code masquerades as the project's current state.

## Placeholder → where to find it

### `docs/observability.md`

| Placeholder | How to find it |
|---|---|
| `<project logger>` | `git grep -lE "zap\|logrus\|slog\|winston\|pino\|getLogger" -- <source directory>`; then check for a **project-owned wrapper** (`internal/pkg/logger`, `src/lib/logger.ts`) — **if there is a wrapper, write the wrapper, not the underlying library** |
| The correct call example | `git grep -n "<wrapper name>" -- <source directory> \| head -20`, picking a real call that covers the convention's key points |
| The actual values of `<level>` | Read the wrapper's definition; some projects use `Warn` and others `Warning`, so **do not write from memory** |
| `<message prefix convention>` | `git grep -n "logger\..*Info(\"" \| head -30`. No consistent convention means this round is settling one: **pick the shape most existing call sites lean towards, write it in, and note in the report that it is new** |
| `<redaction function>` | `git grep -niE "mask\|redact\|sanitize"`; if there is none, that is what this round is building |
| `<how to enable DEBUG>` | `git grep -niE "LOG_LEVEL\|DEBUG\|verbose" -- <config/startup code>` |
| `<log file location>` | The output path in the logger's initialisation code; **do not guess `./logs/app.log`** |
| Metrics / trace entry points | `git grep -lE "prometheus\|opentelemetry\|otel"`; **no hits means no such infrastructure — delete the whole block rather than inventing a standard** |

### `docs/design.md`

| Placeholder | How to find it |
|---|---|
| `<token definition file>` | `git grep -ln "@theme\|--color-\|:root" -- "*.css"` |
| The **actual values** of the token table | Open that file and **copy both the light and dark columns entry by entry**. **The easiest place to get wrong from memory** — enumerate the count, the naming and the values on the spot |
| `<component directory>` | `git ls-files \| grep -E "components/(ui\|primitives)/" \| head` |
| `<cn() and similar class utilities>` | `git grep -n "clsx\|tailwind-merge\|classnames"` |
| `<breakpoints>` / `<mobile hook>` | `git grep -n "useIsMobile\|matchMedia\|max-width"` |
| `<Tooltip>` / `<Popover>` / `<the field description slot>` | `git grep -lniE "tooltip\|popover\|hovercard\|FormDescription" -- <component directory>`; write the **project's own** wrapper where there is one. No hit at all means no tooltip layer — say so in one line and keep the rule ("explanation attaches to its control") rather than naming a component that does not exist |
| The touch behaviour and the `title`-attribute clause | Open the tooltip component and read whether it opens on tap / degrades below a breakpoint — **not the library's documented default from memory**. `git grep -n "title=\"" -- <source directory>`: raw `title` attributes already in use are a cleanup item, not a convention |
| `<existing conventions in this project>` | `git grep -n "<Tooltip" -- <source directory> \| head -20` and state the pattern that actually holds; **no consistent pattern means this round is settling one** |
| `<icon library>` | The `package.json` dependencies; do not write one the project does not have |
| The page skeleton example | **Lift a well-written page that already exists**, removing business detail and keeping the structure |
| The exemption list | `git grep -nE "#[0-9a-fA-F]{3,8}" -- <component directory>`, judging one by one which are genuine exceptions (with a reason) and which await cleanup |

### `docs/develop.md` / `docs/testing.md`

| Placeholder | How to find it |
|---|---|
| Every command | `package.json`'s `scripts` / the `Makefile`'s targets. **Actually run each one once**, in the order: package-manager scripts > Makefile > bare commands |
| `<test runner>` / `<assertion library>` | The test config file and the imports of one real test file |
| `<shared mock entry point>` | `git grep -lE "mock\|__mocks__\|testutils" -- <test directory>` |
| Test file location and naming | `git ls-files \| grep -E "\.(test\|spec)\." \| head` — whether they are **actually** co-located or separate |
| `<path aliases>` | `git grep -n "paths" -- tsconfig.json` or the equivalent |
| The "when touching persistent data" section | First confirm the project **has** persistence: `git ls-files \| grep -iE "migrat\|schema\.(sql\|prisma)\|\.proto$"`, plus any code reading or writing the user's directory / local storage. Not a single hit means delete the whole section |
| `<migration up / down commands>` | The real targets in the `Makefile` / `scripts`, **run both once**; where there is only up, state honestly that this project's migrations are irreversible |
| `<two reviewers / data owner sign-off>` | `CODEOWNERS`, the PR template, branch protection. **With no convention at all, write "at least two reviewers" and flag it in the delivery note as newly added** |

### `docs/architecture.md`

| Placeholder | How to find it |
|---|---|
| The directory tree | `git ls-tree --name-only -d HEAD <each layer's directory>` — **enumerate it, do not write from memory** |
| `<interface name>` / `<registration function>` | `git grep -nE "func Register\|interface .*Handler"` |
| The steps of an extension recipe | **Find a recently added implementation of the same kind and follow its commit to see which files changed** — that is the recipe |
| Dependency direction constraints | `git grep` to verify the current state **really** holds; record existing violations honestly in the exemption list |
| `<generated output>` | `git grep -n "Code generated\|@generated\|DO NOT EDIT"` |

### `AGENTS.md`

| Placeholder | How to find it |
|---|---|
| Stack and versions | `go.mod` / `package.json` / `pyproject.toml`, with **the actual versions** |
| Module path | The first line of `go.mod` / `package.json`'s `name` |
| The architecture diagram | Abbreviated from the real layering in `docs/architecture.md`, not drawn separately |
| Each principle's **concrete landing point** | Real interface names and directory names — see the `architecture.md` rows |
| The "enforced by X" note | Written only after the guardrail **really landed and was verified**. If it has not, tag it `review-only` |

### `e2e/README.md` / `.env.example`

| Placeholder | How to find it |
|---|---|
| The driver, ports, environment variables | Mostly **created this round** — backfill the **values actually used** once built, not the template's example ports |
| `<independent oracle>` | Where the project's data lands (SQLite file / logs / output files): a read path that does not share a source with the UI |
| The service list in `.env.example` | The real external dependencies named in step 2, **deleting any block you do not need** |

## What to do when you cannot find it — three tiers

| Situation | What to do |
|---|---|
| It **is** in the project, I just have not found it | Search another round (different keywords, imports, real call sites). **Do not write until you find it.** |
| It is **not** there, but it is the convention being established this round | It should already be a line on step 2's recommendation list → once signed off, build it → **run it once** → then backfill the real usage. If it is not on that list, it is not being introduced this round |
| It is **not** there, and it is not being built this round | **Delete the whole section.** Do not leave a TODO skeleton |

**Never write a generic example to fill space** because you could not produce the real one.

## Once it is filled in

```bash
# Take 5 symbol names / paths / commands from the generated docs and verify each
git grep -n "<symbol name>" -- <directory> || echo "the doc is lying"
git ls-files --error-unmatch "<path>" || echo "path does not exist"
<command>                                  # actually run it once
```

The full fact-checking discipline is in the generated `docs/documentation.md` — from this moment on, that is the project's own rule.

# How to fill the placeholders: gather the real facts first, then write the document

> Every `<angle bracket>` in a template is **a fact that must be sourced from the project**. This file is how to source them.

## Why this gets its own document

A template gives you the **structure**, not the content. The content all comes from this project — and the easiest accident is not leaving something unfilled, it is **filling in something that looks plausible but is not how this project writes it**:

```go
// ❌ An invented generic shape — the project has no log.Info entry point at all
log.Info("connect success", "target_id", id)

// ✅ The real usage, lifted from the project's existing code
logger.Ctx(ctx).Info("client.Connect: connected",
    zap.String("target_id", id), zap.Duration("cost", cost))
```

The first is worse than writing nothing: it is **a wrong example delivered in an authoritative voice**, agents copy it, and then every review has to correct it once. The documentation loses trust and people stop reading it.

**The rule: every symbol name, path, command and code shape appearing in the docs must be findable with `git grep` on this branch.**

---

## The three-step method

### ① Locate the real source

Find what the **single entry point** for this concept is in the project, and where it lives.

### ② Lift real usage from the project

**Prefer lifting a correct call that already exists in the project** over writing one yourself:

```bash
# Once you have found the entry point, see how it is actually called — pick a representative one
git grep -n "logger.Ctx" -- internal/ | head -20
```

Selection criterion: **the one that covers the convention's key points** (carries ctx, carries structured fields, carries the prefix), rather than the shortest one. You may simplify the irrelevant parts when lifting it into the document, but **not one character of the call shape changes**.

**When the project has no correct usage yet** (the convention is being introduced this round): write a minimal example and **actually compile / run it once** before writing it into the document. Example code that has never run is the next accident.

### ③ Verify it is findable with `git grep`

Once filled in, verify each symbol name and path appearing in the document:

```bash
git grep -n "logger.Ctx" -- internal/ >/dev/null && echo ok || echo "the doc is lying"
git ls-files --error-unmatch src/components/ui/ >/dev/null 2>&1 && echo ok || echo "path does not exist"
```

**Use git-aware commands** (`git grep` / `git ls-files`), not `rg` / `ls` — the latter match uncommitted files, so your local experimental code masquerades as the project's current state.

---

## Placeholder → where to find it

### `docs/observability.md`

| Placeholder | How to find it |
|---|---|
| `<project logger>` | `git grep -lE "zap\|logrus\|slog\|winston\|pino\|getLogger" -- <source directory>`; once found, check whether there is a **project-owned wrapper** (`internal/pkg/logger`, `src/lib/logger.ts`) — **if there is a wrapper, write the wrapper, not the underlying library** |
| The correct call example | `git grep -n "<wrapper name>" -- <source directory> \| head -20`, picking a real call that covers the convention's key points |
| The actual values of `<level>` | Read the logger wrapper's definition; some projects use `Warn` and others `Warning`, so **do not write from memory** |
| `<message prefix convention>` | `git grep -n "logger\..*Info(\"" \| head -30` to see what the existing logs' prefixes look like. No consistent convention means this round is settling one: **pick the shape the majority of existing call sites already lean towards, write it in, and note in the report that it is new this round** — it changes nothing the user can observe and costs a find-and-replace to change later |
| `<redaction function>` | `git grep -niE "mask\|redact\|sanitize"`; if there is none, that is what this round is building |
| `<how to enable DEBUG>` | `git grep -niE "LOG_LEVEL\|DEBUG\|verbose" -- <config/startup code>` |
| `<log file location>` | Read the output path in the logger's initialisation code; **do not guess `./logs/app.log`** |
| Metrics / trace entry points | `git grep -lE "prometheus\|opentelemetry\|otel"`; **no hits means the project has no such infrastructure — delete the whole block rather than inventing a standard** |

### `docs/design.md`

| Placeholder | How to find it |
|---|---|
| `<token definition file>` | `git grep -ln "@theme\|--color-\|:root" -- "*.css"` |
| The **actual values** of the token table | Open that file and **copy both the light and dark columns entry by entry**. **This is the easiest place to get wrong from memory** — enumerate the count, the naming and the values on the spot |
| `<component directory>` | `git ls-files \| grep -E "components/(ui\|primitives)/" \| head` |
| `<cn() and similar class utilities>` | `git grep -n "clsx\|tailwind-merge\|classnames"` to find where the wrapper lives |
| `<breakpoints>` / `<mobile hook>` | `git grep -n "useIsMobile\|matchMedia\|max-width"` |
| `<Tooltip>` / `<Popover>` / `<the field description slot>` | `git grep -lniE "tooltip\|popover\|hovercard\|FormDescription" -- <component directory>`; write the **project's own** wrapper if there is one. No hit at all means the project has no tooltip layer — say so in one line and keep the rule ("explanation attaches to its control"), rather than naming a component that does not exist |
| The touch behaviour and the `title`-attribute clause | Open the tooltip component and read whether it opens on tap / degrades below a breakpoint — **do not write the library's documented default from memory**; and `git grep -n "title=\"" -- <source directory>` to see whether raw `title` attributes are already in use (if they are, that is a cleanup item, not a convention) |
| `<existing conventions in this project>` | Look at where tooltips are used today (`git grep -n "<Tooltip" -- <source directory> \| head -20`) and state the pattern that actually holds; **no consistent pattern means this round is settling one** — write it in and note in the report that it is new |
| `<icon library>` | Read the `package.json` dependencies; do not write one the project does not have installed |
| The page skeleton example | **Lift a well-written page that already exists in the project**, removing the business detail and keeping the structure |
| The exemption list | `git grep -nE "#[0-9a-fA-F]{3,8}" -- <component directory>`, judging one by one which are genuine exceptions (with a stated reason) and which are violations awaiting cleanup |

### `docs/develop.md` / `docs/testing.md`

| Placeholder | How to find it |
|---|---|
| Every command | `package.json`'s `scripts` / the `Makefile`'s targets. **Actually run each one once**, in the order: package-manager scripts > Makefile > bare commands |
| `<test runner>` / `<assertion library>` | Read the test config file and the imports of one real test file |
| `<shared mock entry point>` | `git grep -lE "mock\|__mocks__\|testutils" -- <test directory>` |
| Test file location and naming | `git ls-files \| grep -E "\.(test\|spec)\." \| head` — see whether they are **actually** co-located or in a separate directory |
| `<path aliases>` | `git grep -n "paths" -- tsconfig.json` or the equivalent config |
| The whole "when touching persistent data" section | First confirm whether the project **has** persistence: `git ls-files \| grep -iE "migrat\|schema\.(sql\|prisma)\|\.proto$"`, and whether any code reads or writes the user's directory / local storage. Not a single hit means delete the whole section rather than leaving one about migrations that do not exist |
| `<migration up / down commands>` | Find the real targets in the `Makefile` / `scripts`, and **actually run both once**; if the project has only up and no down, state honestly that "this project's migrations are irreversible" rather than inventing one |
| `<two reviewers / data owner sign-off>` | Look at the repository's existing conventions: `CODEOWNERS`, the PR template, branch protection settings. **With no convention at all, write "at least two reviewers" and point out in the delivery notes that this is a newly added requirement** |

### `docs/architecture.md`

| Placeholder | How to find it |
|---|---|
| The directory tree | `git ls-tree --name-only -d HEAD <each layer's directory>` — **enumerate it, do not write from memory** |
| `<interface name>` / `<registration function>` | `git grep -nE "func Register\|interface .*Handler"` to find the real extension point |
| The steps of an extension recipe | **Find a recently added implementation of the same kind and follow its commit to see which files changed** — that is the recipe |
| Dependency direction constraints | `git grep` to verify the current state **really** holds first; where there are existing violations, record them honestly in the exemption list |
| `<generated output>` | `git grep -n "Code generated\|@generated\|DO NOT EDIT"` |

### `AGENTS.md`

| Placeholder | How to find it |
|---|---|
| Stack and versions | Read `go.mod` / `package.json` / `pyproject.toml`, and **write the actual versions** |
| Module path | The first line of `go.mod` / `package.json`'s `name` |
| The architecture diagram | Abbreviated from the real layering in `docs/architecture.md`, not drawn separately |
| Each principle's **concrete landing point** | See the `architecture.md` row above — principles must land on real interface names and directory names |
| The "enforced by X" note | Written only after the guardrail **really landed and was verified**. If it has not landed, tag it `review-only` |

### `e2e/README.md` / `.env.example`

| Placeholder | How to find it |
|---|---|
| The driver, ports, environment variables | These are mostly **created this round** — backfill the **values actually used** once built, rather than the example ports from the template |
| `<independent oracle>` | See where the project's data lands (SQLite file / logs / output files) and choose a read path that does not share a source with the UI |
| The service list in `.env.example` | List the real external dependencies the user named in step 2, and **delete any block you do not need** |

---

## What to do when you cannot find it — three tiers

| Situation | What to do |
|---|---|
| It **is** in the project, I just have not found it | Search another round (different keywords, look at imports, look at a real call site). **Do not write until you find it.** |
| It is **not** in the project, but it is the convention being established this round | It should already be a line on step 2's recommendation list (what is being introduced, and what it costs) → once that is signed off, build it → **run it once** → then backfill the real usage. If it is not on that list, it is not being introduced this round |
| It is **not** in the project, and it is not being built this round | **Delete the whole section.** Do not leave a TODO skeleton — a hollow document is worse than none, and it trains everyone not to read the docs |

**Never** write a generic example to fill space because you could not produce the real one. That is planting a wrong claim in the docs with authority behind it.

---

## Anti-patterns

| Anti-pattern | Why it is bad |
|---|---|
| Writing `log.Info(...)` as the logging example when the project actually has a wrapper | A wrong example in an authoritative voice, which agents copy |
| Filling a few rows of the token table from memory | Wrong values get copied straight into code; a wrong count makes the whole document look untrustworthy |
| Writing `npm test` as the command when the project uses pnpm and the script is called `test:ci` | The most common initialisation accident; the first person to follow it gets stuck |
| Writing the directory tree from memory | One level too few or too many and the agent creates files in the wrong place |
| Example code that was never compiled | The next accident |
| Verifying with `rg`/`ls` rather than `git grep`/`git ls-files` | Your local uncommitted experimental code masquerades as the project's current state |
| Writing "enforced by X" before the guardrail lands | The document is lying, and nobody will go and check |

---

## Once it is filled in

Spot-check rather than trusting yourself:

```bash
# Take 5 symbol names / paths / commands from the generated docs and verify each
git grep -n "<symbol name>" -- <directory> || echo "the doc is lying"
git ls-files --error-unmatch "<path>" || echo "path does not exist"
<command>                                  # actually run it once
```

The full fact-checking discipline is in the generated `docs/documentation.md` — from this moment on, that is the project's own rule.

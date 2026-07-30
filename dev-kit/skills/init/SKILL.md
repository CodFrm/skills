---
name: init
description: >-
  Use whenever the user mentions initialising or filling in a project's constraints, establishing development standards / engineering conventions / a contributor guide, setting up AGENTS.md or CLAUDE.md, standardising a project, making the agent stop repeating the same mistakes, or setting up the development process for a new project — even when they never say the word "initialise". Use it equally on an existing project when the docs are stale, there are no guardrails, or the same class of problem keeps recurring. Not for: writing a single document, adding a single lint rule, or day-to-day feature development.
---

# Project constraint initialisation (init)

## Core principles

**Docs describe, guardrails enforce.** A convention that lives only in a document with no mechanical check lasts about three months on average — it gets forgotten, routed around, missed in review. So this skill's output always comes in pairs: **one high-value constraint = one piece of documentation (explaining the why and the boundary) + one mechanical check (lint / test / hook)**.

**Only generate what you can fill in for real.** A hollow document is worse than none: it makes people believe "there is a standard here", and what they actually open is a pile of TODOs, after which everyone learns not to read the docs. **If a section's content cannot be discovered and cannot be obtained by asking, do not generate that file.**

**A fact exists in exactly one place.** The higher-level document owns it and the others link to it. Duplication = two copies that drift apart sooner or later, and the agent will only read one of them.

**Existing projects: understand the current state, give recommendations backed by evidence, and only act once the user decides.** A project already running has its own history and its own trade-offs — applying a template without scanning first produces a standard that does not match the code, and very likely overwrites things that were deliberate. **The scan phase writes not one character into the project.**

## When not to use

Wanting to write just one document, wanting to add just one lint rule (do that directly, following the five-part contract in `references/lint-harness.md`), or day-to-day feature development.

**The trigger conditions are in the frontmatter's `description`** — harnesses that do not read frontmatter should treat that paragraph as authoritative.

## What language the documents are written in

**The skill instructions are English; what gets written into the user's repository — and every report and question you put to the user — follows the language the user is asking in.** Ask in Chinese → generate Chinese documents and report in Chinese; ask in English → English.

One exception: **when the repository already has contributor docs in a different language, follow the repository** — half a repo in one language and half in another is worse than either choice, and which language the existing docs are in is something you read off the files rather than ask about; overridable in a word.

This skill's templates are written in English. When generating another language, **translate wholesale, keeping the structure and the links**; do not interleave two languages. Machine-facing tokens (command names, field names, ids) stay ASCII whatever the prose language.

---

## Step 1 · Scan (read-only, no writing)

**Decide which tier to run first:**

```bash
git ls-files | wc -l          # file count
git log --oneline | wc -l     # commit count
```

| Situation | Which tier |
|---|---|
| Empty repository / just started (tens of files, a dozen commits) | **Minimal probe** — the command set below is enough, then go straight to step 2 |
| A project already running | **Deep scan** — run the set below first, then the nine deep-scan items per `references/scanning-existing-projects.md` |

**The point of the deep scan is quantified evidence**, not a file listing. "There are hardcoded colours" and "there are 137 hardcoded colours" lead to completely different actions: the former gets fixed on the spot, the latter has to go through a ratchet baseline. **Without numbers the user cannot decide, and you cannot give a responsible recommendation.**

### Minimal probe (both tiers run this)

Anything you can learn without asking the user, look up yourself.

```bash
# Ecosystem and package manager
ls package.json go.mod Cargo.toml pyproject.toml pom.xml 2>/dev/null
ls pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null

# Existing constraint system (decides "initialise" vs "fill in")
ls AGENTS.md CLAUDE.md CONTRIBUTING.md 2>/dev/null
ls -d docs .github/workflows e2e tests 2>/dev/null

# Existing command entry points (the docs must carry real commands, not invented ones)
[ -f package.json ] && node -e "console.log(JSON.stringify(require('./package.json').scripts,null,2))"
[ -f Makefile ] && grep -E '^[a-z][a-z0-9_-]*:' Makefile

# Existing lint / type / formatting config
ls eslint.config.* .eslintrc* .golangci.y*ml ruff.toml .prettierrc* 2>/dev/null

# Front end and design system as they stand
ls components.json tailwind.config.* 2>/dev/null
git grep -l "@theme\|--color-\|:root" -- '*.css' | head -5

# i18n as it stands
ls -d locales src/locales src/i18n frontend/src/i18n 2>/dev/null

# Existing hooks
ls .husky .git/hooks 2>/dev/null

# CI (decides whether guardrails can attach to a gate that genuinely blocks merges)
ls -d .github/workflows .gitlab-ci.yml .circleci Jenkinsfile 2>/dev/null

# Observability as it stands (is there a logger / metrics / traces, and is anyone using bare print)
git grep -lE "zap\.|logrus|slog\.|winston|pino|logging\.getLogger" -- '*.go' '*.ts' '*.py' | head -5
git grep -lE "prometheus|opentelemetry|otel" -- '*.go' '*.ts' '*.py' | head -5
```

> **Always search content with `git grep`, never `grep -r` / `rg`.** Two reasons: `grep -r` descends into `node_modules` / `dist` / `coverage` (measured at **21 seconds vs 0.08 seconds** on a real mid-sized front-end repository); and it matches **untracked files**, so your local experimental code masquerades as the project's current state — the same rule as the verification discipline in `references/filling-templates.md`. Using `ls` to check whether a file **exists** is fine; searching **content** requires `git grep`.

Questions the probe has to answer:

| Point | Effect |
|---|---|
| Language / ecosystem / package manager | Decides the lint recipe, the test commands, the shape of the guardrails |
| Is there a front-end UI layer | Decides whether to generate `docs/design.md` and colour-token guardrails |
| UI form (web / browser extension / desktop / mobile / no UI) | Decides what drives e2e and how hermetic works |
| Is there i18n | Decides whether to generate i18n guardrails |
| Existing test / lint / build commands | The generated docs **must carry commands that really exist** (selection order below) |
| **Is there CI** | Decides whether guardrails can attach to a gate that genuinely blocks merges; if not, ask |
| Is there a logger / metrics / traces | Decides whether observability is configuration, filling gaps, or not done at all |
| Which constraint files already exist | Decides whether this is "initialise" or "fill in" mode |

### Deep scan (required on an existing project)

Work through the nine items in `references/scanning-existing-projects.md`, each producing **a number + the first 3 samples (file:line)**:

1. Project shape (size, directory distribution, real command entry points)
2. Existing constraint system (length = how much of it is real content; is `CLAUDE.md` nothing but `@AGENTS.md`)
3. **Whether the docs still hold** (broken link count, symbols the docs mention that no longer exist in the code)
4. **How badly "one concept has exactly one implementation" is breached** (how many hardcoded colours / bare logs / hardcoded strings) — the main input to guardrail selection
5. **Recurring problems** (`git log --grep` for same-class fixes, repeatedly-fixed files, revert frequency) — **higher priority than every generic recommendation**
6. Tests as they stand (count, location convention, signals of low-value tests)
7. e2e and verification as they stand (**is there only one track** — with only one, verification scripts get stuffed into the smoke suite)
8. Gates as they stand (does CI exist, does it run the same commands as local, does it genuinely block merges)
9. Observability as it stands (**is there a project-owned logger wrapper** — decides how the doc examples are written)

**Every finding has to trace back to a specific file and line.** When the user pushes back you have to be able to lay it out on the spot, not say "I think".

### Dispatch the nine deep-scan items in parallel

The nine are mutually independent, entirely read-only, and each produces a fixed shape (**a number + the first 3 samples (file:line)**) — precisely the shape best suited to a subagent: hundreds of lines of grep output read, one line reaching the report. **One subagent per item, dispatched in parallel.**

Nail down three things when dispatching:

1. **Read-only.** The scan phase writes not one character into the project — this goes into every subagent's prompt rather than being left to its good sense.
2. **The output shape.** "A number + the first 3 samples (file:line) + one sentence on what it means", not raw command output dumped back.
3. **Search discipline.** Always `git grep` / `git ls-files`, never `grep -r` / `rg` — reasons above.

**Once they return, judging and prioritising is the main session's job.** Step 2's report has to compare the nine results side by side (which is a recurring problem, which is zero-cost, which needs a ratchet), and that requires seeing all nine at once — no subagent has that view.

### How to choose commands (which one goes in the docs)

**Use the package manager if there are package-manager scripts, otherwise the Makefile, and only write bare commands when there is neither.** Priority:

1. **Package-manager scripts** — `npm run lint` / `pnpm test` / `yarn build` (determined by the lockfile).
2. **Makefile targets** — `make lint` / `make test`. Go, C/C++ and mixed-language repositories usually take this route.
3. **Bare commands** — `go test ./...` / `cargo clippy` / `pytest`. Only when neither of the above exists.

**The same command must be one entry point across the docs, pre-commit and CI.** Written three different ways, "green locally, red in CI" eventually appears with nobody knowing why.

When a project has **both** package-manager scripts and a Makefile (common in a front-and-back-end monorepo): take each in its own domain — front-end commands via the package manager, back-end and cross-stack aggregate commands via the Makefile — and state the boundary in `docs/develop.md`.

---

## Step 2 · Produce the diagnosis and recommendations, then wait for the user to decide

**This step's output is a report for the user, not file changes.** After sending the report, **stop and wait for an answer** — write not one file before the user decides.

A new project takes the simplified version (there is nothing much to diagnose, so only the questions); an existing project needs both parts.

**Open with two or three lines of verdict**, then the list. The reader decides from the list — everything else exists to serve that decision, so they should arrive knowing what they are about to read:

> A running browser extension (TS/React, pnpm, ~600 files). The constraint system exists but is documentation-only: no guardrail anywhere, and the docs have drifted from the code. Six recommendations below, two of them P0 — you need only decide which are in.

### A. The recommendation list (the finding and what to do about it, in one row)

**One row per decision**, priority-ordered, each carrying **what to do → the evidence behind it, with its number → cost → recommended or not**.

**The finding and the recommendation are not stated separately.** A findings section followed by a recommendations section says everything twice, leaving the reader to match them up by hand — and it is the same mistake this skill refuses to make in the documents it generates: **a fact exists in exactly one place.** So the evidence lives in the row it justifies, and **a finding that justifies no row — not even a "not recommended" one — changes nothing the user can decide and does not go in the report at all.** That is a selection criterion, not a length limit: cut what decides nothing rather than truncating what does.

| Priority | Recommendation | The evidence behind it | Cost |
|---|---|---|---|
| P0 | Wire an i18n key completeness check into pre-commit | "fix missing i18n key" fixes appear **7 times in the last 200 commits** — a convention that was never mechanised | Half a day, zero existing violations |
| P0 | `console.log` ban + guard test | **3 calls**, with a logger wrapper already present (`src/pkg/logger.ts`) — zero-cost lock-in, and the guardrail fixes them along the way | 1 hour |
| P1 | Colour token guardrail, ratchet baseline of 137 | **137 lines** under `src/pages/**` hold literal colours, against **42 tokens** already defined in `src/index.css` — the convention exists but has no guardrail, and at that scale it cannot be fixed on the spot | Half a day + long-term debt repayment |
| P1 | Split out the `e2e/scratch` track | **Only one track** today, so verification scripts land in the smoke suite and it turns slow and brittle | Half a day |
| P2 | Generate `docs/documentation.md` + a link check in the lint command | **12 broken links**, and 3 symbols the docs name are gone from the code (`OffscreenGMApi`, `SyncHandler`, `parseMeta`) — what is missing here is documentation maintenance discipline | 2 hours |
| P2 | Collapse `CLAUDE.md` into `@AGENTS.md` | `AGENTS.md` (113 lines) and `CLAUDE.md` (**40 lines of independent content**) split the rules; the agent reads one of them | 1 hour, **needs your confirmation on where those 40 lines go** |
| — | Not recommended: metrics / traces | A pure extension project, no long-running server | — |

**The "not recommended" rows get written out.** They prove you considered and excluded it with a reason rather than missing it — and give the user a chance to push back.

**Samples are a reserve, not a column.** The scan produces `file:line` for every finding so you can lay it out on the spot when the user pushes back; the report spends lines on them only where the number does not carry the row on its own. "137 lines under `src/pages/**`" makes its own case — naming three of them adds nothing. "3 symbols the docs mention no longer exist" makes its case **only** once you name them, so there they go inline.

Do not dump raw command output at the user. Several hundred lines of grep results is not a report — the numbers, the conclusions and the costs are.

Ordering basis (high to low): ① recurring problems found by the scan → ② zero-cost lock-in (zero existing violations, the guardrail goes on for free) → ③ badly breached with an established convention → ④ structural gaps (missing track, missing gate) → ⑤ generic gap-filling.

### B. Questions you need answered

**Hard ceiling: usually 3–5, at most 7.** More than that means you are reciting the checklist below rather than asking about this project.

**Every question you ask must come with "this answer will change what I do".** If you cannot say that, do not ask — that is curiosity, not a decision point.

**The default action is "state it and move forward", not "ask and wait".** Anything the scan can already answer gets written as a conclusion for the user to override, rather than an open question.

Take every open item through these three gates in order and **stop at the first one that holds**:

| # | Criterion | Action | Evidence you must keep |
|---|---|---|---|
| 1 | **Findable in the repo or the environment** | Look it up, then just use it. Do not ask | The command and its output, or `file:line` |
| 2 | Not findable, but **cheap to change if wrong**. The test: **does this decision change behaviour the user can observe?** No → this gate; yes → gate 3 | Decide it yourself, **say in one line what you decided and on what basis**, then carry on | The basis — even if it is only "the ecosystem default is X and this project holds no evidence to the contrary" |
| 3 | Not findable, and **wrong means rework or an irreversible cost** | Only now do you ask, in the shape below | The user's own words |

**Gate 1 is the one that gets skipped wholesale.** "When in doubt, ask, do not guess" sounds safe, but it swallows the act of *looking it up* — whether CI exists is visible with `ls .github/workflows`, what the project does is written in the README. Asking a question you could have answered yourself trades the user's time for your thirty seconds.

**Asking less is not the same as guessing more.** Every call you make yourself carries its evidence: a number for scale (`git grep -c`, not "quite a few"), a `file:line` precedent for a selection, the command and its output for a state of the world. **A decision with no evidence is not a decision, it is a guess** — and a guess goes back to gate 1 or up to gate 3.

> **This table, and the language rule above, are deliberately duplicated**, so that this skill can be dropped into a project **on its own**, without the rest of dev-kit — which is also why gate 2's test is written into the row rather than left to a reference this project may not have. [`using-dev-kit`](../using-dev-kit/SKILL.md) holds the same rules for the rest of the kit. **The language rule lives in those two places; the three-gate table lives in three** — the third is [asking-users.md](../using-dev-kit/references/asking-users.md), which owns the rule, registers every copy, and carries the fuller treatment (what counts as evidence for which kind of decision, the four-part form for a question, the per-round ceiling). **Change one, change all of them.**

> ❌ "How is e2e driven in this project?"
> ✅ "Found `playwright.config.ts`, driving a browser extension. **Building the scratch track on that basis**; say so if that is wrong."

The difference: without an answer the first cannot proceed, while the second can. **Only things that genuinely block you deserve to be questions.**

#### Only these two get asked every time

1. **Which rows of the list are in and which are out?** — the one core decision point.
2. **Which of those findings were deliberate?** — the mistake existing projects invite most is treating someone's deliberate trade-off as an oversight and "fixing" it. Skip this one on a new project.

**These two close the report.** The last thing the reader sees is the decision they owe you, not more evidence. Whatever the candidate pool below settled on their behalf goes in one line each **just above** them, so the defaults are visible at the moment of deciding rather than buried further up.

#### The rest is a candidate pool — asked only when the trigger fires

**If it does not fire, do what the "default" column says and note in the report that you decided it that way.**

| Candidate question | Ask only when… | Default when unasked |
|---|---|---|
| What the project does | README / package.json / existing docs **do not say** | Write what you read and let the user override |
| Are there "repeatedly violated conventions" the scan missed | The scan found **no** repeat signal in git history | If it found one, use that; no need to ask |
| Should real-environment verification be wired up (`.env`) | External dependencies were found but it is **unclear** whether real hardware is needed | No external dependencies found → do not generate |
| How far to take observability | The project has **no** logger / metrics / trace infrastructure yet | A wrapper already exists → only add the logging convention; metrics and traces **not done** |
| How the CI gate is arranged | **No** CI was found | Found → wire into the existing job, just do it |
| i18n / dark and light / mobile | A front end was found, and it is **unclear** whether these exist | Found an i18n directory/theme tokens/breakpoints → build on what is there |
| Colour token status | A front end was found but there is **no** token system | Tokens exist → the guardrail bans literal colours outright |
| Which are "known debt, not addressed now" | The existing violations found are **numerous enough to need a ratchet** | Few violations → fix them on the spot, no need to ask |

**The three observability pieces are still traded off independently** (logging is on by default; metrics only with a long-running server; traces only across services) — but **you judge that from the scan**, rather than throwing three questions at the user. If the project has no corresponding infrastructure, **do not do it**; do not invent a hollow standard.

#### How to write a question

Bring **your recommendation** and **the basis**, so the user can decide by changing one word:

> ❌ "Do you want i18n?"
> ✅ "Found no i18n library at all, but the commit history has 5 i18n-related fixes — it looks planned but never landed. **I lean towards not adding i18n guardrails this round**, and adding them when it is genuinely wired in. Agree?"

### After the decision

Trim the later steps to the user's decision: **a recommendation the user cut is not done**, not "done while I was in there". If the user changed the priorities, follow theirs.

**Do not default on the user's behalf for a question they did not answer.** Better to ask again than to produce a standard built on guesswork.

---

## Step 3 · Generate the documents

### File list and ownership

| File | What it owns | When generated |
|---|---|---|
| `AGENTS.md` | Project facts + **the must-read routing table** + non-negotiable engineering principles + a quick architecture map | Always |
| `CLAUDE.md` | **One line: `@AGENTS.md`** | Always |
| `docs/README.md` | The documentation index | When more than 2 docs are generated |
| `docs/develop.md` | The concrete "how": commands, structure, style, enforced rules, the process and review tier when persistent data is touched, the commit flow | Always |
| `docs/architecture.md` | Layering, dependency direction, extension points, "how to add an X" | When there is clear layering |
| `docs/testing.md` | How tests are designed, what to write, what not to, how to run them | Always |
| `docs/verification.md` | How to confirm a change really works (the local e2e verification workflow) | When there is a drivable runtime form |
| `docs/design.md` | The design system: tokens, component reuse, theming, motion, states, where explanation lives, the new-page recipe | When there is a front-end UI |
| `docs/observability.md` | Log levels and where to instrument, metrics, traces, using them to investigate a reproduction | **When the user confirmed it in step 2** |
| `docs/documentation.md` | How the documentation itself is maintained and fact-checked | When more than 3 docs are generated |
| `docs/references/*.md` | Detail that does not fit in a main document | Split out only when a main document's section exceeds ~80 lines |
| `e2e/README.md` | The twin-track explanation + scratch usage + report rules | When doing e2e |
| `.env.example` | The environment variable list for local real-hardware verification | When there are real external dependencies |
| `.gitignore` additions | The scratch track, `.env`, test output | When doing e2e |

The templates are in `templates/`, whose **directory structure matches the target**, so copy them across position by position:

```
templates/
├── AGENTS.md.template         → <project root>/AGENTS.md
├── CLAUDE.md.template         → <project root>/CLAUDE.md
├── env.example                → <project root>/.env.example
├── gitignore-additions.txt    → appended to <project root>/.gitignore
├── docs/                      → <project root>/docs/
│   ├── README.md  develop.md  architecture.md
│   ├── testing.md  verification.md  design.md
│   ├── observability.md  documentation.md
│   └── references/verification-report-template.md
└── e2e/README.md              → <project root>/e2e/README.md
```

**Three file names differ from their landing names, so rename while copying**: `AGENTS.md.template` / `CLAUDE.md.template` carry the `.template` suffix to stop a harness auto-loading them as locally-effective instruction files; `env.example` has no leading dot to avoid becoming a hidden file inside the template directory. Consequently the **relative links pointing at those three inside the template directory do not resolve** — they become correct after the rename on landing, which is expected, so do not "fix" them.

**A template is a skeleton, not a finished product.** The HTML comment block at the top of each template states its conditional sections and hard rules; **delete the comment block along with everything else once it is filled in**.

### How to fill the placeholders (read `references/filling-templates.md` before starting)

The template gives you the **structure**; the content all comes from this project. The accident at this step is not leaving something unfilled, it is **filling in something that looks plausible but is not how this project writes it** — especially code examples:

```
❌ log.Info("connect success", "target_id", id)          // an invented generic shape
✅ logger.Ctx(ctx).Info("client.Connect: connected",     // lifted from the project's existing code
       zap.String("target_id", id))
```

The first is worse than writing nothing: **it is a wrong example delivered in an authoritative voice**, later agents copy it, every review has to correct it once, and then everyone stops reading the docs.

**Three hard rules:**

1. **Every symbol name, path, command and code shape appearing in the docs must be findable with `git grep` on this branch.** Verify with `git grep` / `git ls-files`, not `rg` / `ls` — the latter match uncommitted files, so your local experimental code masquerades as the project's current state.
2. **Lift example code from real calls already in the project**, picking the one that covers the convention's key points, simplifying the irrelevant parts while changing not one character of the call shape. When the project has no correct usage yet (the convention is being introduced this round), write a minimal example and **actually compile/run it once** before writing it into the docs.
3. **If the project has its own wrapper, write the wrapper, not the underlying library.** If logging has `internal/pkg/logger`, write that rather than `zap`; if class merging has `cn()`, write that rather than `clsx`. **The wrapper's existence is itself the convention.**

**What to do when you cannot find it — three tiers, and there is no fourth:**

| Situation | What to do |
|---|---|
| It **is** in the project, I just have not found it | Search another round (different keywords, look at imports, look at real call sites). **Do not write until you find it.** |
| It is **not** in the project, but it is the convention being established this round | It should already be a line on step 2's recommendation list (what is being introduced, and what it costs) → once that is signed off, build it → **run it once** → then backfill the real usage. If it is not on that list, it is not being introduced this round |
| It is **not** in the project, and it is not being built this round | **Delete the whole section.** Do not leave a TODO skeleton |

**Never write a generic example to fill space just because you could not find the real one.**

`references/filling-templates.md` gives a lookup table for **where in the project to find** each placeholder (logger entry point, token file, component directory, commands, extension points, generated output, …); work through it item by item.

### How to write AGENTS.md

> **Read `references/agents-md-authoring.md` before starting** — it owns: the four things and only four things that go in AGENTS.md, how to write **the must-read routing table** (the three elements of "when → read what → what it owns"), the three-gate criterion for engineering principles (decidable / landing on a concrete extension point in this repository / carrying a why), a list of high-value principles to draw on per project, and the delivery self-check.

The one-line version: **AGENTS.md holds only project facts, the must-read routing table, non-negotiable principles and a quick architecture map** — every "how to" detail sinks into `docs/`, leaving only a link here. **The longer it gets, the less it is read.**

---

## Step 4 · Pin the guardrails (lint)

> **Read `references/lint-harness.md` before starting** — it owns the full method: the escalation ladder (do not write a custom rule when an off-the-shelf one can be switched on), the **five-part delivery contract**, how to write guard tests, how to wire into CI, the four pre-commit design rules, how to converge an old project with a ratchet, and the common-mistakes table. Ready-made code is in `references/lint-recipes-ts.md` / `references/lint-recipes-go.md`.

**Criteria for choosing rules, in priority order:**

1. The "repeatedly violated conventions" the user named in step 2 — highest priority.
2. The "one concept must have exactly one implementation" class (colour tokens, notification wrappers, logging entry points, time handling).
3. Architectural dependency direction (layer A must not import layer B).
4. Things that fail silently (missing i18n keys, generated files edited by hand).

**Do not add rules to make up the numbers.** A rule nobody has ever violated only manufactures noise and trains everyone to reach for `eslint-disable`.

### Five hard requirements

1. **Every rule comes with a guard test.** See `references/lint-harness.md` — a guard test runs by **loading the project's real lint configuration** and asserts in both directions: a violating fixture must be reported, and compliant code and exempted files must not be. That verifies not just the rule's logic but that "the rule really was wired into the configuration with the right severity and scope", **preventing a fake guardrail where the rule was written but never took effect**.
2. **Every rule needs an exemption mechanism and an exemption list**, with a stated reason for each entry. A constraint with no exemption list gets quietly broken — people find another way around it.
3. **A rule's error message gives the correct form and where it comes from**, not just "forbidden". Format: `do not write X, use Y (defined in Z); reason: W. See docs/xxx.md#anchor`.
4. **On an old project, run a new rule once and see how much it reports.** Several hundred hits means the code should change first or the scope should narrow; merging it straight in only gets everyone to switch it off.
5. **It must attach to a gate that can block merges.** Add it to the project's **existing** `lint` / `test` command and confirm CI really runs that command. In a repository with no CI a rule is only a suggestion — either stand up a minimal CI per the step 2 answers, or state the limitation clearly in `docs/develop.md`, **rather than pretending there is a gate**.

### Ready-made recipes

- TypeScript / React → `references/lint-recipes-ts.md` (colour token ban, hardcoded i18n string ban, `no-restricted-imports`/`no-restricted-properties` for must-use-the-wrapper, guard tests)
- Go → `references/lint-recipes-go.md` (architectural dependency gate via `go test`, golangci configuration points)
- Other ecosystems → write it against the escalation ladder in `references/lint-harness.md`.

**Only those two ecosystems ship copy-paste code.** The method — the ladder, the five-part contract, the guard test — is identical everywhere, but in any other stack you write the rule yourself against that stack's own tooling (ruff's banned-api, import-linter, a custom analyzer, a repository-scanning test). **Say so in the report**, so the user is not left expecting the same volume of output a TypeScript repository would get.

**When doing observability, pin these two while you are there** (both belong to "one concept has exactly one implementation"):

- **A single logging entry point** — ban `console.log` / the standard library `log` / `print`, exempting only the project's logger wrapper itself.
- **Sensitive fields never reach the logs** — ban passing particular field names or types straight into the logger, exempting only the redaction function.

### pre-commit

When setting up pre-commit, copy these (details in `references/lint-harness.md`):

- Check only staged files, never the whole repository — otherwise people fall into the habit of `--no-verify`.
- Check the snapshot in the git index, not the working tree — this prevents bypassing the check by "staging the broken version and reverting the working tree to the good one".
- Trigger conditionally by changed file type — run i18n validation only when a locale changed.
- Leave an escape hatch (`SKIP_PRE_COMMIT=1`) and state in the docs when it may be used.

---

## Step 5 · Build the twin e2e tracks

**Two tracks, different purposes, different destinations, never mixed:**

| | Smoke e2e | Local verification e2e |
|---|---|---|
| Location | `e2e/` (committed) | `e2e/scratch/` (**gitignored**) |
| Purpose | Prevent regressions in basic functionality | "I just finished X — does it actually work?" |
| Lifetime | Permanent | Disposable |
| External dependencies | **All mocked** | May reach a real environment (via `.env`) |
| Bar for entry | **Very high** — core/high-value flows only | Low — write one whenever you want to check |
| Output | A green light in CI | `e2e/scratch/<task-name>/report.md` |

Mechanical guarantees that are mandatory (details in `references/e2e-harness.md`):

- Two configurations: the main one `testIgnore`s scratch, and the scratch one's `testDir` points at scratch. gitignore alone is not enough — the guarantee needed is that CI **can never pick up** scratch while it stays runnable locally at any time.
- The hermetic checklist: a temporary data directory, bypassing the system keychain/credential store, a dedicated port (not colliding with the dev instance), skipping the single-instance lock, and a startup assertion (confirming that what you connected to really is the application under test, **preventing a false green when another process holds the port**).
- Protocol mocks built as standalone single files, zero dependencies, with the port passed to the spec through an environment variable. This is the reusable shape for "some external dependency really is reachable" tests.
- An independent oracle: besides asserting the UI, query the database/logs directly to cross-check. Trusting the UI alone misses a failed database write.
- Orchestration in a script written in **a real language the project already builds with** (not shell): responsible for cross-platform behaviour, reaping leftover processes and deleting temporary directories, **keeping the logs on failure and cleaning up only on success**.

**`references/e2e-harness.md`'s worked examples are Playwright/Node**, because they are the most compact way to show the shape. The guarantees above are the ecosystem-neutral part: in another stack **keep the guarantee and build the equivalent out of what the project already has** — do not drag in a runtime the repository does not otherwise use just to own its e2e.

**The bar for committing a smoke e2e is written to sting.** One e2e is minutes of overhead plus long-term maintenance debt. Only "the application starts, main navigation, core CRUD, critical data integrity" earns a commit. When in doubt use scratch: **promotion to permanent is a separate, deliberate decision.**

### Report rules (written into `e2e/README.md` and `docs/verification.md`)

- **One directory per verification scenario, and `<task-name>` is a slug** — lowercase, hyphenated, no spaces, since it is a directory name. **Where the verification is acceptance against an approved spec, that slug is the spec's**, so a round's evidence never splits across two directories; write that rule into `docs/verification.md`, which owns it, rather than into both files.
- **Create `report.md` before the run** and fill it in as you go — do not reconstruct it afterwards from memory.
- **The form of evidence follows what is being verified**, and the table deciding that lives in the generated `docs/references/verification-report-template.md` — write the pointer, not a second copy that drifts from it. **It is not "there must be pictures"**: a scenario directory with no UI holding only `report.md`, `logs/` and `resources/` is the right shape; do not screenshot a terminal to manufacture evidence (unsearchable, undiffable, and likely to drag in the neighbouring window).
- **Evidence goes inline, not linked out**: one scroll through the report should be enough to reach a verdict without opening any side file. Commands go into a code block along with the exit code and the lines that decide the conclusion, with a link left for the full output; a screenshot `![]()` **comes with one sentence on what it proves**; paired screenshots (before/after, light/dark) go in a two-column table; a recording **must come with key still frames** (a recording cannot be skimmed).
- **Bare links are for archives/binaries only, and never listed bare** — every item states what it proves and how to read it.
- Redact before pasting.
- The honesty clause: state failures plainly without softening them; when reproducing a bug, declare whether the scratch assertion asserts "the expected behaviour (stays red)" or "the current buggy contract (green, and must flip once fixed)" — pick one and write it into the report. **Never describe red as green.**

### Directories and gitignore

```
e2e/
├── README.md              # committed: the twin-track explanation, how to run, report rules
├── <smoke specs>          # committed: core flows
├── fixtures/              # committed: protocol mocks, test fixtures
└── scratch/               # ← the whole directory is gitignored
    └── <task-name>/
        ├── report.md      # the human-readable report
        ├── screenshots/
        ├── videos/
        └── resources/
```

Appended to `.gitignore` (template in `templates/gitignore-additions.txt`):

```gitignore
# One-off local verification scripts and evidence (see docs/verification.md); not committed, not in CI
e2e/scratch/

# Environment variables for local real-hardware verification; .env.example is the committed template
.env
```

---

## Step 6 · Self-verification (it is not done until this step is)

Generated is not the same as working. Go through this in order, actually running every item:

1. **Does the newly added lint run?** Run it once and see how much it reports. A flood on an old project → back to step 4 to narrow the scope or change the code first.
2. **Does the guard test really go red?** Manually comment one rule out of the configuration, confirm the guard test **fails**, then restore it. An unverified guard test is the same as none.
3. **Does every command in the docs really exist?** Run each one. **Invented commands are the most common initialisation accident.**
   Then take **5 symbol names / paths** from the generated docs and verify each with `git grep` / `git ls-files` — if even one cannot be found, re-check that whole document from the top.
4. **Do all the relative links in the docs resolve?**
5. **Once `.env.example` is copied to `.env`, can the harness read it?** (if generated)
6. **Does the smoke e2e actually run green?** (if a skeleton was generated, at least one has to pass)
7. **Does CI really run these commands?** Look at the steps in the CI configuration and confirm lint (including the new guardrails) and tests (including the guard tests) are in there. If no CI was set up, confirm `docs/develop.md` states the limitation clearly.
8. **Are the logs really emitted per the convention?** (if observability was done) Run the application once, catch a log line, and confirm the level, prefix, structured fields and correlation id all match the docs — **the format described in the docs not matching the format the code actually emits is this area's most common accident.**

Then finish by running the project's verification command.

**Items 3 and 4 suit parallel subagent dispatch** (running each command in the docs, `git grep`-checking each sampled symbol, resolving each relative link) — high volume, mechanical, read-only, and the report shape is fixed: "what was checked, which do not exist". **Do not dispatch item 2**: it changes the configuration and changes it back, so dispatching it collides with someone else's experiment. Anyone can do the rest, but **the conclusions come back to the main session** — one unfindable symbol means re-checking that whole document from the top, and that judgement needs the global view.

---

## Step 7 · The delivery note (short — only what the diff does not show)

One closing message, and **the documentation is the deliverable, not this**. The user can already see which files landed; `git status` shows that better than a list would. What they cannot see is what you decided on their behalf and what you left undone, so the note carries **only** that:

- **Decided for you** — one line per gate-2 call: what you chose, on what basis.
- **Not done, and why** — what they cut, what a trigger never fired for, what turned out blocked. A recommendation they cut needs one line, not a defence.
- **Whether the guardrails can actually block a merge** — wired into CI / pre-commit only / no gate at all. This one line decides whether any of the rest survives contact with the next deadline.
- **Conflicts with existing conventions** (fill-in mode) — what the template assumed, what the project does, which one you followed.

**A heading with nothing under it gets left out, not written as "none".** Keep it **under 15 lines**: a delivery note long enough to need skimming is one more document nobody reads, which is the very failure this skill exists to prevent.

---

## Fill-in mode (when the project already has some constraints)

The process is exactly the same as above — step 1's deep scan and step 2's diagnosis-and-wait already cover "diff before acting". Fill-in mode's four extra rules are **only about how to treat things that are already there**:

1. **Never overwrite existing content.** Where something exists but is incomplete (an `AGENTS.md` with no routing table, e2e with no scratch track) → **add to the original file**, preserving its wording, structure and order. The templates are supplementary material, not replacements.
2. **Follow the existing style.** Whatever heading levels, tone and link style the existing docs use, follow them — a new section in a jarringly different style reads as foreign and gets treated as noise.
3. **Report conflicts; do not resolve them silently.** When existing content contradicts this skill's recommendation (they mandate tests in a separate directory while the template assumes co-located, say) → **the project's existing convention wins**, so go with theirs and lay the conflict out in the step 7 delivery note: what the template assumed, what the project does, which one you followed. That is a statement, not a question — it only becomes a question when following their convention would break something this round is building on, and then it goes on the recommendation list with a recommendation.
4. **Do not "fix" a deliberate trade-off as an oversight.** This is fill-in mode's easiest mistake — step 2's second standing question exists to catch it, so do not touch those places before it is answered.

---

## Red Flags — stop when you catch yourself thinking these

| Thought | Reality |
|---|---|
| "Generate all the doc skeletons first, fill in the content later" | A hollow document is worse than none; it trains people not to read the docs. If it cannot be filled in for real, do not generate that file. |
| "Write the lint rule now, add the guard test later" | An unverified guardrail is a fake guardrail — the rule may never have been loaded by the configuration. Deliver them as a pair or do not deliver. |
| "Putting more in AGENTS.md is safer" | The longer it gets the less it is read, and the detail starts fighting the docs. It holds only facts, routing, principles and the architecture map. |
| "Everyone understands this constraint, no need to write the why" | A constraint with no why gets routed around by the first "this case is special". |
| "The test command is probably `npm test`" | Inventing commands is the most common initialisation accident. Write what you found; if you cannot find it, ask. |
| "Build the smoke e2e first, do the scratch track later" | Without the scratch track, people stuff verification scripts into the smoke suite, and it quickly becomes slow and brittle. Both tracks stand up together. |
| "Put the full guardrail set on the old project directly" | A rule reporting several hundred errors is switched off the next day. Narrow the scope or change the code first. |
| "This is a mature project, just apply the template" | Applying without scanning produces a standard that does not match the code, and overwrites things that were deliberate. Scan, recommend, wait for the decision. |
| "Finished scanning, may as well fix the obvious ones" | The scan phase writes not one character into the project. A recommendation the user cut is not done, not "done while I was in there". |
| "The user did not answer that one, default to the common practice" | For a decision point that changes the output, better to ask again; but for candidates whose trigger did not fire, take the default, do it, and say so — do not accumulate a question list. |
| "Asking every question on the list is safer" | **More than 5 questions means reciting the list.** Every question has to come with "this answer will change what I do"; if it cannot, do not ask — anything the scan can answer gets written as a conclusion for the user to override. |
| "A generic shape for the logging example is fine, it gets the idea across" | If the project has a wrapper, the wrapper is what gets written. A wrong example in an authoritative voice gets copied, which is worse than writing nothing. |
| "I cannot find this placeholder, write something plausible" | The three tiers do not include "invent one": find it, build it and then fill it in, or delete the section. |
| "The user did not mention i18n / dark mode / mobile, so probably not needed" | Those three are **asked about**, not guessed. Retrofitting costs far more than doing it from the start. |
| "One subagent per document, generating in parallel is faster" | "A fact exists in exactly one place" breaks on the spot — written separately, the same thing appears in three inconsistent versions, and the agent will only read one. Documents are written by the main session; if you must dispatch, do **one document at a time**, stating what it owns and which content belongs to other files. |
| "State the findings first, then the recommendations — that is more rigorous" | It says everything twice and leaves the reader matching the two halves up by hand. **The evidence goes in the row it justifies**, and a finding justifying no row does not go in the report at all — the same "a fact exists in exactly one place" this skill imposes on every document it generates. |
| "The scan is dispatched anyway, let them write the recommendations too" | Prioritising means comparing all nine results side by side (which is a recurring problem, which is zero-cost, which needs a ratchet), and no subagent has that view. They report facts; judgement is the main session's job. |
| "It is all generated, should be fine" | Every item in step 6 gets actually run. Especially: every command in the docs. |

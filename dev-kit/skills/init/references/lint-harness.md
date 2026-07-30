# Guardrails (the harness): pinning conventions into mechanical fact

> Ready-made code is in [`lint-recipes-ts.md`](./lint-recipes-ts.md) / [`lint-recipes-go.md`](./lint-recipes-go.md). This file is the method: **which ones to pin, how to pin them, and how to be sure they stayed pinned**.

**A convention living only in a document or in review is a request.** A guardrail turns it into mechanical fact: a check attached to an **existing gate that can block merges**, plus a test keeping that check honest — because **an unverified guardrail rots into a fake one**.

## Which ones to pin (in priority order)

**The criterion: can a program answer "was it violated: yes/no" with near-zero false positives.** If not, leave it to review. "Keep it readable" is not a candidate; neither is anything the type system already catches.

**1 · The "repeatedly violated conventions" the user named** — the highest-value input, **ahead of every generic recommendation**, because they are already proven unstoppable by documentation alone. Substitute signals where you cannot get an answer: `git log --grep` for same-class fixes, review comments, issues saying "same problem as last time".

**2 · "One concept must have exactly one implementation".** Once breached this class spreads exponentially, and **the breach is silent**:

| Concept | Single entry point | What a breach looks like |
|---|---|---|
| Colour | Design tokens | `#1296db` / `text-blue-500` in a component |
| User-visible strings | i18n's `t()` | Hardcoded source-language text |
| Notifications / toasts | The project's notify wrapper | Calling the underlying library directly |
| Logging | The project's logger | Standard library log / `console.log` |
| Date formatting | The project's date utility | Calling dayjs/moment directly |
| Encryption / credentials | The project's credential module | encrypt/decrypt written inline |

**3 · Architectural dependency direction** — "layer A must not import layer B". Review almost never holds this, because the violating change looks reasonable on its own.

**4 · Things that fail silently** — a missing i18n key falling back to the key name, a generated file edited by hand, a migration edited after environments ran it, keys not aligned across locales, a field missing from the logs that investigation needs.

**What not to pin: a rule nobody has ever violated.** It manufactures noise and trains everyone to reach for `eslint-disable`.

## The escalation ladder — pick the cheapest level that holds

**Only move down a level when the current one cannot express it.**

| Level | For | Instances |
|---|---|---|
| 1. Enable and scope an existing rule | The linter already has it | ESLint `no-floating-promises` scoped to `src/pages/**`; enabling a golangci linter that is off |
| 2. Declarative bans | Banning a package, export, API or global | ESLint `no-restricted-imports` / `-properties` / `-globals`; ruff banned-api; golangci `depguard` / `forbidigo` |
| 3. AST / pattern selectors | Any syntactic shape, zero custom code | ESLint `no-restricted-syntax`; semgrep |
| 4. A custom lint rule | Logic is needed: unwrapping chains, inspecting arguments | An ESLint rule file; a go/analysis analyzer; a flake8 plugin |
| 5. A repository-scanning test | The invariant spans files, or spans non-code output | A test walking the tree: every `t("ns:key")` resolves in the locale files; an architecture test banning cross-layer imports |
| 6. A CI script | Cannot be linted per file | Whether the changelog was updated; whether generated files are in sync |

**The ladder is a concept, not an ESLint feature** — every ecosystem has instances at each level, and a repository-scanning test can be written in any test runner. **Architecture and dependency-direction constraints have dedicated tools, which beat a custom rule**: dependency-cruiser / eslint-plugin-boundaries (JS), import-linter (Python), depguard (Go).

**Ban the throat, not the symptom.** Ban the **import** of `dayjs` rather than matching `.format()` calls: a renamed import and chained variants cannot slip past an import ban, and it will not misfire on another library's `.format()`.

## The five-part delivery contract (missing one means it is not done)

**1 · The check attaches to an existing gate that can block merges.** Add the rule to the configuration the project's **existing** `lint` / `test` command already reads. A new script nobody calls, or a new workflow in a repository that never had CI, **is a suggestion**. Where the project has no CI: either stand up CI first ([below](#wiring-into-ci)), or explicitly accept "caught only locally + in pre-commit" and state that limitation in the docs. **Do not pretend there is a gate.**

**2 · A precise scope + an exemption for the sanctioned implementation.** The rule takes effect only where the convention applies, and **the wrapper that is allowed to do the banned thing** — whose existence is the reason the ban holds — gets a **configuration-level, path-scoped** exemption, not an inline disable. Without it the wrapper goes red first, and the rule gets weakened so a release can ship.

**3 · The error message teaches the correct form** — one sentence naming the sanctioned alternative and the reason:

> *"Use `formatDate()` from `src/utils/date.js` — timezone handling must happen in exactly one place (AGENTS.md)."*

**Including an issue number** (`#135`) is better still: a constraint holds when it carries where it came from. Genuine exceptions go through an inline disable **with a stated reason**.

**4 · A guard test that loads the real configuration and asserts in both directions.** Run the configuration the project **actually uses** (in JS, `new ESLint({ cwd })`; in any ecosystem, the real lint command over fixture files):

- **Every banned form is reported** — including the variants your chosen level permits (renamed imports, namespace imports, optional chaining, computed property names).
- **Compliant code and exempted paths are not reported** — **false positives are the number one cause of a guardrail being deleted.**

The guard test must be picked up by the project's existing test command. Testing the rule in isolation (RuleTester, `analysistest` with inline settings) only proves the logic, not the wiring, the severity or the scope.

**Verify manually once before delivering**: comment the rule out of the configuration → run the guard test → **confirm it goes red** → restore. Without that step a guard test can stay green while reporting nothing at all — a config filter, a file name that does not match, a misspelled rule name.

**5 · The documentation points at the guardrail, and the whole tree is green when it lands.** Annotate the convention document: *"Enforced since `<date>` by `<rule name>` in `<config file>`; exceptions via `<mechanism>`."* **Fix every existing violation in the same change** — a gate that is red on arrival gets reverted, not respected. Too many to fix means a **ratchet**: freeze the current violators into an enumerated exemption baseline that **only shrinks**.

## Wiring into CI

**In a repository with no CI, a rule is only a suggestion**: pre-commit can be skipped with `--no-verify` and local lint relies on good intentions.

1. **Probe** for CI (`.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, …).
2. **Present** → wire the guardrail into the job it already runs; **do not create a parallel job**, nobody looks at the second one.
3. **Absent** → check for a remote (`git remote -v`). With one, **put the minimal CI on the recommendation list as a P0 with its cost** and let it ride with step 2's sign-off. With no remote, do not build one: say in the report that guardrails stay at the pre-commit tier, and why.

```yaml
# .github/workflows/ci.yml — the minimal usable form
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - <install runtime and dependencies>
      - run: <lint command>          # including every guardrail rule
      - run: <typecheck command>
      - run: <test command>          # including the guard tests
      - run: <build command>
      - run: <smoke e2e command>     # if there is one
```

4. **No CI and no remote** → **state the limitation explicitly** in `docs/develop.md`: the guardrails take effect only in local lint and pre-commit, and pre-commit can be skipped.

**The commands CI runs must be the same ones run locally** (both via package-manager scripts or Makefile targets), or you get "green locally, red in CI" with nobody knowing why.

## How to land it on an old project

Run it once **before** adding the rule and see how much it reports:

| How much it reported | What to do |
|---|---|
| 0–20 | Fix them all in the same change, then merge |
| Tens to hundreds | **Ratchet**: freeze into an enumerated exemption baseline that only shrinks |
| Thousands | The rule or the scope was chosen wrong. Narrow to the highest-value directory, or restructure the code first |

The baseline goes in the configuration (not scattered inline disables), commented "**only shrinks**" with the freeze date.

**Take an inventory before rewriting anything**: (a) recurring review comments, (b) documentation claims that do not survive `git grep`, (c) past production incidents. Each becomes either a principle (review-only) or a guardrail candidate. **Mechanise the highest-recurrence one first**, and let it become the template every later convention copies.

> **Tag every principle in the principles document: "enforced by `<gate>`" or "review-only".** That review-only column is the **standing pool of guardrail candidates**.

## How to design pre-commit

Four rules; missing any one gets it routed around with `--no-verify`. **pre-commit is not a substitute for the gate** — it can be skipped, so treat it as earlier feedback; the real gate is CI.

### 1. Check only staged files, never the whole repository

A whole-repository lint makes every commit wait tens of seconds, and within a week everyone has learned to add `--no-verify`.

```sh
git diff --cached --name-only -z --diff-filter=ACMR -- "*.ts" "*.tsx" | xargs -0 <lint command>
```

### 2. Check the snapshot in the git index, not the working tree

**The easiest to miss, and the most fatal**: checking the working tree means "stage the broken version, then revert the working tree to the good one" bypasses the check entirely.

```sh
# git checkout-index reads the index directly, touching neither the working tree nor the index
snapshot=$(mktemp -d)
git checkout-index --all --prefix="$snapshot/"
<check command> --root="$snapshot"
rm -rf "$snapshot"
```

### 3. Trigger conditionally by changed file type

i18n validation only when a locale changed. **`--diff-filter` must include `D`**: deleting a locale file has to trigger the consistency check too.

```sh
changed=$(git diff --cached --name-only -z --diff-filter=ACMRD -- "<locale path>")
[ -n "$changed" ] && <i18n validation command>
```

### 4. Leave an escape hatch, and state when it may be used

A hook with no escape hatch forces `--no-verify`, which skips **every** hook and leaves no trace.

```sh
if [ "$SKIP_PRE_COMMIT" = "1" ]; then
  echo "⏭ SKIP_PRE_COMMIT=1, skipping the pre-commit checks"
  exit 0
fi
```

**Optional: escalate by branch** — run the full suite additionally when committing on `main` / `release/*`.

## When one convention grows into a set of rules

The five-part contract applies **per rule**, plus:

- **Stable rule IDs + a rule handbook.** Number the diagnostics (`FXC4002` style), carry the ID in every error, give each rule a Bad/Good pair — violations become searchable, suppressible and teachable.
- **Auto-fix whatever can be fixed mechanically** (ESLint `fix`, go/analysis `SuggestedFixes`). A self-healing gate gets adopted rather than switched off; the auto-fix gets its own fixture.
- **Encode the runtime's real contract; do not add extra drama.** If the framework treats an empty `method` as GET, the rule must accept it — **a rule stricter than reality trains everyone to switch the guardrail off.**
- **A compiled plugin needs an extra wiring guard.** Have the `lint` target run the plugin's own tests, lint a known-compliant sample with the **built** binary, and rebuild that binary when the plugin's source changes.

## Pre-delivery self-check

- [ ] Wired into an **existing** gate that can block merges (the project's `lint` / `test` command + CI)
- [ ] Precisely scoped, with a configuration-level exemption for **the sanctioned wrapper**
- [ ] The error message gives the correct form + the reason + where it comes from
- [ ] **The guard test loads the real configuration**, asserts both directions, and runs under the project's existing test command
- [ ] **The rule was commented out of the configuration and the guard test confirmed to go red**, then restored
- [ ] The documentation entry is annotated "enforced since `<date>` by `<check name>`; exceptions via `<mechanism>`"
- [ ] The whole tree is green when it lands (or there is an exemption baseline that only shrinks)

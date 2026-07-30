# Guardrails (the harness): pinning conventions into mechanical fact

> Ready-made code is in [`lint-recipes-ts.md`](./lint-recipes-ts.md) / [`lint-recipes-go.md`](./lint-recipes-go.md). This file is the method: **which ones to pin, how to pin them, and how to be sure they stayed pinned**.

**A convention living only in a document or in review is a request.** A guardrail turns it into mechanical fact: a check attached to an **existing gate that can block merges**, plus a test keeping that check itself honest.

**The core: docs describe, gates enforce — and the guardrail needs its own regression test, because an unverified guardrail rots into a fake one.**

---

## Which ones to pin (in priority order)

### The criterion: can a program answer "was it violated: yes/no" with near-zero false positives

If not, leave it to review. "Keep it readable" and "name things well" are not guardrail candidates; neither is anything the type system or existing tooling already catches.

### Priority 1: the "repeatedly violated conventions" the user named

The highest-value input at initialisation, **ahead of every generic recommendation**. Things that recur in review, that have been said aloud several times, that were tripped over last time — they are already proven to be unstoppable by documentation alone.

Substitute signals when you cannot get an answer: `git log --grep` for same-class fixes, reading review comments, finding issues saying "same problem as last time".

### Priority 2: "one concept must have exactly one implementation"

Once breached, this class spreads exponentially, and **the breach is completely silent**:

| Concept | Single entry point | What a breach looks like |
|---|---|---|
| Colour | Design tokens | `#1296db` / `text-blue-500` appearing in a component |
| User-visible strings | i18n's `t()` | Hardcoded source-language text |
| Notifications / toasts | The project's notify wrapper | Calling the underlying library directly |
| Logging | The project's logger | Using the standard library log / `console.log` |
| Date formatting | The project's date utility | Calling dayjs/moment directly |
| Encryption / credentials | The project's credential module | Writing encrypt/decrypt inline |

### Priority 3: architectural dependency direction

"Layer A must not import layer B". Review almost never holds this, because the change that violates it usually looks perfectly reasonable on its own.

### Priority 4: things that fail silently

Things that **do not error, they just behave wrongly**: a missing i18n key (falling back to the key name), a generated file edited by hand, a migration edited (environments that already ran it will not re-run), keys not aligned across locales, a field required for investigation missing from the logs.

### What not to pin

**A rule nobody has ever violated** — it only manufactures noise and trains everyone to reach for `eslint-disable`.

---

## The escalation ladder — pick the cheapest level that holds

**Only move down a level when the current one cannot express it.**

| Level | For | Instances |
|---|---|---|
| 1. Enable and scope an existing rule | The linter already has it | ESLint `no-floating-promises` enabled only under `src/pages/**`; enabling a golangci linter that exists but is off |
| 2. Declarative bans | Banning a package, export, API or global | ESLint `no-restricted-imports` / `-properties` / `-globals`; ruff banned-api; golangci-lint `depguard` / `forbidigo` |
| 3. AST / pattern selectors | Any syntactic shape, zero custom code | ESLint `no-restricted-syntax`; semgrep rules |
| 4. A custom lint rule | Logic is needed: unwrapping chains, inspecting arguments | An ESLint rule file; a go/analysis analyzer; a flake8 plugin |
| 5. A repository-scanning test | The invariant spans files, or spans non-code output | A test walking the tree: every `t("ns:key")` resolves in the locale files; an architecture test banning cross-layer imports |
| 6. A CI script | Cannot be linted per file | Whether the changelog was updated; whether generated files are in sync with their source |

**The ladder is a concept, not an ESLint feature** — every mainstream ecosystem has instances at each level, and a repository-scanning test can be written in any test runner.

**Architecture and dependency-direction constraints have dedicated tools, which beat a custom rule**: dependency-cruiser / eslint-plugin-boundaries (JS), import-linter (Python), depguard (Go).

### Ban the throat, not the symptom

Ban the **import** of `dayjs` rather than matching `.format()` calls — a renamed import and chained variants cannot slip past an import ban, and it will not misfire on another library's `.format()`.

---

## The five-part delivery contract (missing one means it is not done)

### 1. The check attaches to an existing gate that can block merges

Add the rule to the configuration the project's **existing** `lint` / `test` command already reads. A new script nobody calls, or a new workflow in a repository that never had CI, **is a suggestion, not enforcement**.

> When the project does **not yet** have CI, this rule means: either stand up CI first (see [Wiring into CI](#wiring-into-ci)), or explicitly accept "caught only locally + in pre-commit" and state that limitation in the docs. **Do not pretend there is a gate.**

### 2. A precise scope + an exemption for the sanctioned implementation

The rule takes effect only where the convention applies. **The wrapper that is allowed to do the banned thing** — whose existence is the very reason the ban holds — gets a **configuration-level, path-scoped** exemption, not an inline disable.

Without the exemption, the wrapper itself goes red first, and then the rule gets weakened so a release can ship.

### 3. The error message teaches the correct form

One sentence naming the sanctioned alternative and the reason:

> *"Use `formatDate()` from `src/utils/date.js` — timezone handling must happen in exactly one place (AGENTS.md)."*

The violator can fix it correctly without archaeology. **Including an issue number** (`#135`) is better still — a constraint holds when it carries "where it came from". Genuine exceptions go through an inline disable **with a stated reason**.

### 4. A guard test that loads the real configuration and asserts in both directions

Run the configuration the project **actually uses** — in JS, `new ESLint({ cwd })`; in any ecosystem, the real lint command can be run over fixture files and the output asserted. **Both directions get asserted:**

- **Every banned form is reported** — including the variants your chosen level permits (renamed imports, namespace imports, optional chaining, computed property names).
- **Compliant code and exempted paths are not reported** — **false positives are the number one cause of a guardrail being deleted.**

The guard test's name and location must be picked up by the project's existing test command — **a guard test nobody runs is itself a fake guardrail**.

> **Testing the rule in isolation (RuleTester / `analysistest` with inline settings) only proves the logic, not the wiring, the severity or the scope.** Manual verification proves it for that moment, not for tomorrow — only a test stops the rule being quietly deleted or narrowed later.

**Verify manually once before delivering**: comment the rule out of the configuration → run the guard test → **confirm it goes red** → restore. Without that step, a guard test can stay green while reporting nothing at all, because of a config filter, a file name that does not match, or a misspelled rule name.

### 5. The documentation points at the guardrail, and the whole tree is green when it lands

Update the corresponding convention document: *"Enforced since `<date>` by `<rule name>` in `<config file>`; exceptions via `<mechanism>`."*

**Fix every existing violation in the same change** — a gate that is red the moment it lands gets reverted, not respected.

When there are too many existing violations to fix, use a **ratchet**: freeze the current violators into an enumerated exemption baseline that **only shrinks**. New code complies immediately while the existing debt burns down slowly.

---

## Wiring into CI

**In a repository with no CI, a rule is only a suggestion.** pre-commit can be skipped with `--no-verify` and local lint relies on good intentions — only CI is the layer that genuinely blocks a merge.

At initialisation:

1. **Probe** for CI (`.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, …).
2. **Present** → wire the new guardrail into the job it already runs; **do not create a parallel job** (nobody looks at the second one).
3. **Absent** → check whether there is a remote to run one on (`git remote -v`). With a remote, **put the minimal CI below on the recommendation list as a P0 with its cost** and let it ride with the rest of step 2's sign-off — a separate question about it is one more thing to answer for something already on the list. With no remote, do not build one: say in the report that guardrails stay at the pre-commit tier here and why. The **minimal** form, once it is agreed:

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

4. **No** → **state the limitation explicitly** in `docs/develop.md`: "this repository has no CI, so the guardrails take effect only in local lint and pre-commit, and pre-commit can be skipped". **Do not pretend there is a gate.**

**The commands CI runs must be the same ones run locally** (both via package-manager scripts or Makefile targets), or the two drift and you get "green locally, red in CI" with nobody knowing why.

---

## How to land it on an old project

Run it once **before** adding the rule and see how much it reports:

| How much it reported | What to do |
|---|---|
| 0–20 | Fix them all in the same change, then merge. |
| Tens to hundreds | **Ratchet**: freeze into an enumerated exemption baseline that only shrinks. |
| Thousands | The rule or the scope was chosen wrong. Narrow to the highest-value directory first, or restructure the code first. |

The exemption baseline goes in the configuration (not scattered inline disables), with a comment stating "**only shrinks**" and the freeze date.

### The inventory order for an existing repository

Do not start by rewriting. Take an inventory first: (a) recurring review comments, (b) documentation claims that do not survive `git grep`, (c) past production incidents. Each becomes either a principle (review-only) or a guardrail candidate. **Mechanise the one with the highest recurrence rate first, and let it become the template every later convention copies.**

> **Tag every principle in the principles document: "enforced by `<gate>`" or "review-only".** That review-only column is the **standing pool of guardrail candidates** — next time someone violates one, take it out of the pool and pin it.

---

## How to design pre-commit

Four rules; missing any one gets it routed around with `--no-verify`.

**pre-commit is not a substitute for the gate** — it can be skipped, so treat it purely as earlier feedback; the real gate is CI.

### 1. Check only staged files, never the whole repository

A whole-repository lint makes every commit wait tens of seconds, and within a week everyone has learned to add `--no-verify`.

```sh
git diff --cached --name-only -z --diff-filter=ACMR -- "*.ts" "*.tsx" | xargs -0 <lint command>
```

### 2. Check the snapshot in the git index, not the working tree

**The easiest to miss, and the most fatal.** Checking the working tree directly means "stage the broken version, then revert the working tree to the good one" bypasses the check entirely — what gets committed is the broken version while the hook checked the good one.

```sh
# git checkout-index reads the index directly, touching neither the working tree nor the index itself
snapshot=$(mktemp -d)
git checkout-index --all --prefix="$snapshot/"
<check command> --root="$snapshot"
rm -rf "$snapshot"
```

### 3. Trigger conditionally by changed file type

Run i18n validation only when a locale changed. **`--diff-filter` must include `D`** — deleting a locale file has to trigger the consistency check too.

```sh
changed=$(git diff --cached --name-only -z --diff-filter=ACMRD -- "<locale path>")
[ -n "$changed" ] && <i18n validation command>
```

### 4. Leave an escape hatch, and state when it may be used

```sh
if [ "$SKIP_PRE_COMMIT" = "1" ]; then
  echo "⏭ SKIP_PRE_COMMIT=1, skipping the pre-commit checks"
  exit 0
fi
```

A hook with no escape hatch forces people to use `--no-verify` (which skips **every** hook, and is worse than leaving one switch that leaves a trace).

**Optional: escalate by branch.** Run the full test suite additionally when committing on `main` / `release/*` — mistakes on those branches cost more.

---

## When one convention grows into a set of rules

The five-part contract applies **per rule**, plus three more:

- **Stable rule IDs + a rule handbook.** Number the diagnostics (`FXC4002` style), carry the ID in every error, and give each rule a Bad/Good pair in the rule documentation — violations become searchable, suppressible and teachable.
- **Auto-fix whatever can be fixed mechanically.** A self-healing gate (ESLint `fix`, go/analysis `SuggestedFixes`) gets adopted rather than switched off. The auto-fix itself gets verified in a fixture too.
- **Encode the runtime's real contract; do not add extra drama.** If the framework treats an empty `method` as GET, the rule must accept it — **a rule stricter than reality trains everyone to switch the guardrail off.**
- **A compiled plugin needs an extra wiring guard.** Unit fixtures only prove the logic. Have the `lint` target do three extra things: run the plugin's own tests, lint a known-compliant sample with the **built** binary, and rebuild that binary when the plugin's source changes.

---

## Common mistakes

| Mistake | Consequence |
|---|---|
| Strengthening the documentation rather than the gate | Documentation does not run itself; the next violation merges just the same |
| Writing a custom rule when a built-in rule or selector would do | Pure added maintenance cost |
| Banning the call shape rather than the entry point | Renamed/chained variants escape; unrelated libraries get hit |
| Leaving no exemption for the sanctioned wrapper | The wrapper goes red first and the rule gets weakened so a release can ship |
| Verified manually once, with no guard test | The rule gets quietly deleted or narrowed later — a fake guardrail |
| No assertion in the "must not false-positive" direction | The first misfire gets the rule switched off repository-wide |
| Attaching to a gate that never runs | A speculative CI file / a script nobody calls = only a suggestion |
| Saying only "do not do X" without "do Y instead" | The violator guesses, then switches the rule off |

---

## Pre-delivery self-check

Every new guardrail passes:

- [ ] Wired into an **existing** gate that can block merges (the project's existing `lint` / `test` command + CI).
- [ ] Precisely scoped, with a configuration-level exemption for **the sanctioned wrapper** (not an inline disable).
- [ ] The error message gives the correct form + the reason + where it comes from.
- [ ] **The guard test loads the real configuration**, asserts in both directions, and is picked up by the project's existing test command.
- [ ] **The rule was manually commented out of the configuration and the guard test confirmed to go red**, then restored.
- [ ] The corresponding documentation entry is annotated "enforced since `<date>` by `<check name>`; exceptions via `<mechanism>`".
- [ ] The whole tree is green when it lands (or there is an explicit exemption baseline that only shrinks).

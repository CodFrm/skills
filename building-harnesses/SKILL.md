---
name: building-harnesses
description: Use when a project convention keeps getting violated despite being documented — the same review comment repeats, AGENTS.md/CLAUDE.md rules get ignored, "we agreed to never X" regressions keep landing — or when introducing a new convention that would otherwise rely on memory, docs, or review to hold. Also use when asked to bootstrap or overhaul a repo's engineering process: contributor/agent guidelines (AGENTS.md/CLAUDE.md), engineering principles, docs organization and staleness cleanup, or a "verify it actually works" workflow. Covers import/API bans, styling or token rules, architectural constraints, and cross-file consistency (e.g. source keys vs locale files).
---

# Building Harnesses

## Overview

A convention that lives only in docs or review is a request. A **harness** makes it a mechanical fact: a check that fails an existing merge-blocking gate, plus tests that keep the check itself honest.

**Core principle: docs describe, gates enforce — and the harness itself gets regression tests, because an unverified guardrail rots into a fake one.**

Asked to set up a repo's engineering process from scratch? Jump to **Bootstrapping the whole process** — harnesses are its enforcement layer.

## When to use

- The same violation keeps landing despite documentation and review comments.
- An agent-facing rule (AGENTS.md / CLAUDE.md) gets ignored by agents with stale context.
- You are about to write a doc rule that a machine could enforce instead.

**When NOT to use:** judgment calls with no decidable predicate ("keep it readable", "name things well"), or things the type system / an existing tool already rejects. Litmus test: can a program answer "violation: yes/no" with near-zero false positives? If not, it stays a review item.

## Escalation ladder — pick the cheapest rung that holds

Only move down a rung when the current one cannot express the check.

| Rung | Use for | Instances |
|---|---|---|
| 1. Enable + scope an existing rule | the linter already has it | ESLint `no-floating-promises` on `src/pages/**` only; revive `context-as-argument` |
| 2. Declarative ban | ban a package, export, API, or global | ESLint `no-restricted-imports` / `-properties` / `-globals`; ruff banned-api; golangci-lint depguard / forbidigo |
| 3. AST / pattern selector | any syntax shape, zero custom code | ESLint `no-restricted-syntax`; a semgrep rule |
| 4. Custom lint rule | needs logic: unwrap chains, inspect arguments | an ESLint rule dir; a go/analysis analyzer; a flake8 plugin |
| 5. Repo-scan test | invariant spans files or non-code artifacts | a test walking the tree: every `t("ns:key")` literal resolves in the locale JSON |
| 6. CI script | not per-file lintable | changelog updated; generated file in sync |

**Ban the choke point, not the symptom shape.** Restrict the `dayjs` *import* rather than matching `.format()` calls: renamed imports and chained variants cannot dodge an import ban, and you don't false-positive other libraries' `.format()`.

The rungs are concepts, not ESLint features — every mainstream stack has an instance of each, and repo-scan tests run in any test runner.

Architecture and dependency-direction conventions ("api must not import controller", "repository never imports service") have dedicated tools before custom rules: dependency-cruiser / eslint-plugin-boundaries (JS), import-linter (Python), depguard (Go).

## The contract — a finished harness ships all five parts

1. **A check wired into an existing merge-blocking gate.** Add the rule to the config that the repo's existing `lint` / `test` command already runs. A new script nobody calls, or a CI workflow in a repo that has no CI, is advisory — not enforcement.

2. **Precise scope + a sanctioned-implementation exemption.** Apply the rule only where the convention applies. The one module that is *allowed* to do the banned thing — the wrapper whose existence justifies the ban — gets a config-level exemption scoped to its path, not an inline disable.

3. **An error message that teaches the fix.** Name the sanctioned alternative and the reason in one sentence: *"Use formatDate() from src/utils/date.js — timezone conversion must happen in one place (AGENTS.md)."* Violators fix without archaeology. Genuine exceptions use an inline disable **with a reason comment**.

4. **Guard tests that load the real config.** Run the check through the repo's actual configuration — JS: `new ESLint({ cwd })`; any stack: invoke the real lint command against fixture files and assert on its output — and assert **both directions**:
   - each banned form is reported — including the variants your rung permits (renamed or namespace imports, optional chaining, computed keys);
   - sanctioned patterns and the exempted path are **not** reported — false positives are how harnesses get deleted.

   Name and place the guard tests so the repo's existing test command picks them up — a guard test nobody runs is itself a fake guardrail. Testing the rule in isolation (RuleTester / `analysistest` with inline settings) proves logic but not wiring, severity, or scope; a one-time manual check proves nothing tomorrow — only a test stops the rule from being silently deleted or descoped later.

5. **Docs point at the harness; the tree lands green.** Update the convention doc: *"enforced by `<rule>` in `<config>` since `<date>`; exceptions via inline disable + reason."* Fix all existing violations in the same change — a gate that lands red gets reverted, not respected.

## Worked example (ESLint instance — same shape in any stack)

```js
// eslint.config.mjs — rung 2: ban the import, exempt the sanctioned wrapper
{
  files: ["src/**/*.js"],
  rules: {
    "no-restricted-imports": ["error", { paths: [{
      name: "dayjs",
      message: "Use formatDate()/formatDateTime() from src/utils/date.js — timezone handling lives in one place (AGENTS.md).",
    }] }],
  },
},
{ files: ["src/utils/date.js"], rules: { "no-restricted-imports": "off" } },
```

```js
// harness.test.mjs — guard tests through the REAL config: wiring + scope + both directions
import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: import.meta.dirname });
const ids = async (file, code) =>
  (await eslint.lintText(code, { filePath: file }))[0].messages.map((m) => m.ruleId);

it("catches a renamed dayjs import in business code", async () => {
  expect(await ids("src/pages/x.js", `import d from "dayjs";\nexport const y = d();`)).toContain("no-restricted-imports");
});
it("exempts the sanctioned wrapper", async () => {
  expect(await ids("src/utils/date.js", `import dayjs from "dayjs";\nexport const f = () => dayjs();`)).toEqual([]);
});
it("does not flag compliant code", async () => {
  expect(await ids("src/pages/x.js", `import { formatDate } from "../utils/date.js";\nexport const y = formatDate(0);`)).toEqual([]);
});
```

Before landing: run the gate once with a known violation still present and watch it fire on real code; then fix the violations and confirm the gate is green.

For a production-scale instance — every rung, guard tests, and all three bootstrap layers in one real repo — read [references/example-scriptcat.md](references/example-scriptcat.md).

## Scaling to a rule pack

When one convention grows into many (layering + naming + handler signatures), the five-part contract applies per rule, plus:

- **Stable rule IDs + a rules handbook.** Number diagnostics (`FXC4002`-style), carry the ID in every message, and keep one Bad/Good pair per rule in a rules doc — violations become searchable, suppressible, and teachable.
- **Auto-fix what is mechanical.** A gate that repairs (ESLint `fix`, go/analysis `SuggestedFixes`) gets adopted instead of disabled. Verify fixes in the fixture runner (`RuleTester` `output`, `analysistest.RunWithSuggestedFixes`).
- **Encode the runtime's real contract, not extra taste.** If the framework treats an empty `method` as GET, the rule must accept it — stricter-than-reality rules train people to disable the harness.
- **Compiled plugins need a wiring guard of their own.** Unit fixtures (Go `analysistest` testdata with `// want "FXC4002"` comments) prove logic only. Make the `lint` target additionally (a) run the plugin's tests, (b) lint a known-good example corpus with the **built** binary, and (c) rebuild that binary whenever plugin sources change — the compiled-toolchain equivalent of "guard tests load the real config".

## Bootstrapping the whole process

Harnesses are the enforcement layer of a three-layer system. When asked to set up (or overhaul) a repo's engineering process, ship all three layers — gates enforce what is decidable, principles govern what is not, and a verification playbook closes the gap between "tests are green" and "it actually works".

Order: mechanize one real convention end-to-end first (it becomes the exemplar every later convention copies), then the principles doc pointing at it, then the docs index, then the verification playbook. Everything lands green.

### Layer 1 — Principles (the judgment layer)

`AGENTS.md` is a thin entry page — non-negotiable principles, an architecture quick-map, and "before doing X, read docs/Y" pointers; `CLAUDE.md` only imports it. Each principle is tagged either *enforced by `<gate>`* or *review-only* (the review-only list is the standing harness-candidate pool) and carries a one-line why — rules without reasons get cargo-culted, then dropped. The principles that earn a place:

- **Confirm before you fix.** Reproduce the reported bug and prove it exists → capture it in a failing test → fix. In that order — never fix from assumption.
- **TDD/BDD first.** Failing test before implementation; `describe`/`it` titles state *behavior*, in the team's language, not implementation details. A failing test means fix the code, not the test. Delete meaningless tests outright (tautologies, pass-throughs, tests that assert the mock) — but verify each against its source before deleting.
- **Fix root causes, not symptoms.** No `as any` / `@ts-ignore` / swallowed errors to silence a symptom; prefer refactoring over bolting on a patch. (Partially harnessable: lint bans on `ts-ignore`, empty catch.)
- **SOLID via the repo's existing extension points.** New entity → the established base abstraction; new message/route → the existing registration point. Inject dependencies through constructors; depend on narrow interfaces, not concrete classes.
- **Direct replacement over adapter sandwiches.** Swapping a backend/library replaces it in place — no `interface + LegacyImpl + NewImpl` unless both must coexist at runtime.
- **Reuse before reinvent.** Before writing a component, helper, or token, search the existing catalog and codebase for one that already does it, and extend at the established extension point. Extract a shared implementation when the same block lands its **second** occurrence — one implementation (one value, one place) per concept, so a fix lands everywhere at once. This complements scope discipline: reuse what exists, copy nothing, don't pre-abstract for hypothetical needs.
- **Scope discipline.** Bug fix ≠ cleanup PR: touch only files the task requires; no helpers or abstractions you don't need today.
- **Comments say the non-obvious why.** A comment states a constraint or reason the code cannot express; comments that narrate the steps get deleted.
- **No dead code.** Delete outright — no commented-out blocks or `// removed` markers; git remembers.

### Layer 2 — Docs that stay true (the knowledge layer)

- **Topology.** One entry doc per topic (`docs/<topic>.md`); heavy detail splits into `docs/references/<topic>-<sub>.md`; `docs/README.md` is the index with an ownership table. Every fact has exactly **one owning doc**; everyone else cross-links — a fact copied into two docs will drift apart.
- **Minimal doc set to scaffold:** the principles entry page; a how-doc (commands, structure, style and language conventions, testing mechanics, commit/PR rules — single-purpose commits in the repo's changelog-feeding format, PR template with linked issues, review judges the diff not the description); the verification playbook; the doc-maintenance guide; the index.
- **Truth discipline.** If you can't `git grep` it on the current branch, don't claim it. Verify claims with git-aware commands (`git grep` / `git ls-files` / `git ls-tree`) — plain `rg`/`ls` also match *untracked* files, so unmerged work masquerades as shipped. Every count ("7 locales") is enumerated from the canonical source, never trusted from prose or memory.
- **Staleness cleanup.** On any discrepancy, fix the *doc* to match the code — the branch's code is the source of truth (unless the code is genuinely buggy: then fix the code and say so). Delete outdated content instead of stacking corrections on it.
- **One-shot doc verification.** The maintenance doc keeps a runnable block: a relative-link integrity check plus one git-aware command per concrete claim type. Run it before any doc change lands; renames/moves update the index and every referencing doc in the same change.

### Layer 3 — Verification playbook (the reality layer)

Green unit tests prove the behaviors you asserted — not that the feature works. `docs/verification.md` owns "how to confirm a change actually works":

- **Cheap signals first.** Typecheck and unit tests before ever driving the real app.
- **Drive the real thing.** Exercise the affected flow end-to-end with real inputs and observe real outputs, covering the boundaries that motivated the change.
- **Verification ≠ growing the E2E suite.** Use one-shot throwaway scratch scripts in a git-ignored dir (reusing the E2E harness's fixtures); never run the full heavy suite just to check one thing, never leave permanent specs behind casually.
- **Evidence, kept local.** Screenshots/logs/`report.md` go to a git-ignored evidence dir and get referenced in the PR or conversation — evidence before assertions. Promotion into the permanent suite is a separate, deliberate decision.
- **Reproduction is step one of a fix.** A scratch repro *is* the "confirm it exists" step — it never replaces the failing committed test that must follow.

### Retrofitting an existing repo

Start with an inventory, not a rewrite: (a) review comments that keep repeating, (b) doc claims that fail the git-grep test, (c) past incidents. Each item becomes a principle (review-only) or a harness candidate. Mechanize the highest-recurrence candidate first as the exemplar, delete doc claims that are no longer true, then proceed layer by layer as above.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Strengthening the doc instead of the gate | docs don't run; the next violation lands anyway |
| Custom rule when a built-in or selector suffices | maintenance you didn't need |
| Banning the call shape, not the entry point | renamed/chained variants escape; unrelated `.format()` false-positives |
| No exemption for the sanctioned wrapper | the wrapper itself goes red; the rule gets weakened to ship |
| Verified once by hand, no guard test | rule silently deleted or descoped later — fake guardrail |
| No false-positive assertions | first innocent hit gets the rule turned off repo-wide |
| Wiring into a gate that doesn't run | speculative CI file or unused script = advisory only |
| "Don't do X" without "do Y instead" | violators guess, then disable the rule |

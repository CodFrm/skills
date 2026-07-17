---
name: building-harnesses
description: Use when a project convention keeps getting violated despite being documented — the same review comment repeats, AGENTS.md/CLAUDE.md rules get ignored, "we agreed to never X" regressions keep landing — or when introducing a new convention that would otherwise rely on memory, docs, or review to hold. Covers import/API bans, styling or token rules, architectural constraints, and cross-file consistency (e.g. source keys vs locale files).
---

# Building Harnesses

## Overview

A convention that lives only in docs or review is a request. A **harness** makes it a mechanical fact: a check that fails an existing merge-blocking gate, plus tests that keep the check itself honest.

**Core principle: docs describe, gates enforce — and the harness itself gets regression tests, because an unverified guardrail rots into a fake one.**

## When to use

- The same violation keeps landing despite documentation and review comments.
- An agent-facing rule (AGENTS.md / CLAUDE.md) gets ignored by agents with stale context.
- You are about to write a doc rule that a machine could enforce instead.

**When NOT to use:** judgment calls with no decidable predicate ("keep it readable", "name things well"), or things the type system / an existing tool already rejects. Litmus test: can a program answer "violation: yes/no" with near-zero false positives? If not, it stays a review item.

## Escalation ladder — pick the cheapest rung that holds

Only move down a rung when the current one cannot express the check.

| Rung | Use for | Example |
|---|---|---|
| 1. Enable + scope an existing rule | the linter already has it | `no-floating-promises` on `src/pages/**` only |
| 2. Declarative ban: `no-restricted-imports` / `-properties` / `-globals` | ban a package, export, or API | ban `@radix-ui/react-*` singles in favor of merged `radix-ui` |
| 3. AST selector: `no-restricted-syntax` | any syntax shape, zero custom code | ban `forwardRef(...)` calls |
| 4. Custom lint rule | needs logic: unwrap chains, inspect arguments | ban `t(key, { defaultValue })` but allow `<Tabs defaultValue>` |
| 5. Repo-scan test | invariant spans files or non-code artifacts | every `t("ns:key")` literal resolves in the locale JSON |
| 6. CI script | not per-file lintable | changelog updated; generated file in sync |

**Ban the choke point, not the symptom shape.** Restrict the `dayjs` *import* rather than matching `.format()` calls: renamed imports and chained variants cannot dodge an import ban, and you don't false-positive other libraries' `.format()`.

The ladder is tool-agnostic: ESLint (JS/TS), ruff banned-api / flake8 plugins (Python), golangci-lint depguard / forbidigo (Go), semgrep anywhere; repo-scan tests run in any test runner.

Architecture and dependency-direction conventions ("api must not import controller", "repository never imports service") have dedicated tools before custom rules: dependency-cruiser / eslint-plugin-boundaries (JS), import-linter (Python), depguard (Go).

## The contract — a finished harness ships all five parts

1. **A check wired into an existing merge-blocking gate.** Add the rule to the config that the repo's existing `lint` / `test` command already runs. A new script nobody calls, or a CI workflow in a repo that has no CI, is advisory — not enforcement.

2. **Precise scope + a sanctioned-implementation exemption.** Apply the rule only where the convention applies. The one module that is *allowed* to do the banned thing — the wrapper whose existence justifies the ban — gets a config-level exemption scoped to its path, not an inline disable.

3. **An error message that teaches the fix.** Name the sanctioned alternative and the reason in one sentence: *"Use formatDate() from src/utils/date.js — timezone conversion must happen in one place (AGENTS.md)."* Violators fix without archaeology. Genuine exceptions use an inline disable **with a reason comment**.

4. **Guard tests that load the real config.** Instantiate the linter against the actual config file (`new ESLint({ cwd })`, or import the flat config into a `Linter`) and assert **both directions**:
   - each banned form is reported — including the variants your rung permits (renamed or namespace imports, optional chaining, computed keys);
   - sanctioned patterns and the exempted path are **not** reported — false positives are how harnesses get deleted.

   Name and place the guard tests so the repo's existing test command picks them up — a guard test nobody runs is itself a fake guardrail. Testing the rule in isolation (RuleTester with an inline config) proves logic but not wiring, severity, or scope; a one-time manual check proves nothing tomorrow — only a test stops the rule from being silently deleted or descoped later.

5. **Docs point at the harness; the tree lands green.** Update the convention doc: *"enforced by `<rule>` in `<config>` since `<date>`; exceptions via inline disable + reason."* Fix all existing violations in the same change — a gate that lands red gets reverted, not respected.

## Worked example

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

## Scaling to a rule pack

When one convention grows into many (layering + naming + handler signatures), the five-part contract applies per rule, plus:

- **Stable rule IDs + a rules handbook.** Number diagnostics (`FXC4002`-style), carry the ID in every message, and keep one Bad/Good pair per rule in a rules doc — violations become searchable, suppressible, and teachable.
- **Auto-fix what is mechanical.** A gate that repairs (ESLint `fix`, go/analysis `SuggestedFixes`) gets adopted instead of disabled. Verify fixes in the fixture runner (`RuleTester` `output`, `analysistest.RunWithSuggestedFixes`).
- **Encode the runtime's real contract, not extra taste.** If the framework treats an empty `method` as GET, the rule must accept it — stricter-than-reality rules train people to disable the harness.
- **Compiled plugins need a wiring guard of their own.** Unit fixtures (Go `analysistest` testdata with `// want "FXC4002"` comments) prove logic only. Make the `lint` target additionally (a) run the plugin's tests, (b) lint a known-good example corpus with the **built** binary, and (c) rebuild that binary whenever plugin sources change — the compiled-toolchain equivalent of "guard tests load the real config".

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

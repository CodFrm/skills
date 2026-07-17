# Real-repo instance: ScriptCat

[ScriptCat](https://github.com/scriptscat/scriptcat) (an MV3 browser extension, TypeScript + React) runs every rung of the ladder and all three bootstrap layers in production. Use it as a shape reference — the file names are theirs, the pattern is yours.

## The ladder, instantiated

| Rung | ScriptCat instance |
|---|---|
| 1 — existing rule, scoped | Type-aware `@typescript-eslint/no-floating-promises` / `no-misused-promises` / `await-thenable` as `error` on `src/pages/**` only (tests excluded) — missing `await`s caught exactly where they bite the UI |
| 2 — declarative ban | `no-restricted-imports` bans `@radix-ui/react-*` single packages (use the merged `radix-ui`) and the `sonner` `toast` export (use the `notify` wrapper) |
| 3 — AST selector | `no-restricted-syntax` bans `forwardRef` across `src/pages/**` (React 19 `function` + ref-prop instead) |
| 4 — custom rules | `eslint-rules/` at the repo root: `no-i18n-default-value` (bans `t(key, { defaultValue })` inline fallbacks — they leak hardcoded text to every language), `no-raw-color-classname` (bans raw palette/hex colors in `className` — design tokens only, so light and dark both work), `require-last-error-check` (enforces `chrome.runtime.lastError` handling) |
| 5 — repo-scan test | `src/locales/i18n-usage.test.ts`: every `t("ns:key")` literal in source must resolve in the locale JSON files — source keys and 8 locale packs cannot drift apart |
| Guard tests | `eslint-rules/harness.test.mjs` exercises the syntax-based rules through the real flat config — wiring, scope, and both directions |

Note the pairing: each custom rule exists because a documented convention kept getting violated, and each error message names the sanctioned alternative.

## The three layers, instantiated

- **Layer 1 — principles.** `AGENTS.md` is the thin entry page: non-negotiable engineering principles (confirm-before-fix, TDD/BDD-first, SOLID via existing extension points, direct replacement over adapters, scope discipline, no dead code) plus an architecture quick-map and "before X, read docs/Y" pointers. `CLAUDE.md` contains only `@AGENTS.md`.
- **Layer 2 — docs.** `docs/README.md` indexes everything with an ownership table. Entry docs (`develop.md`, `design.md`, `architecture.md`, `verification.md`, `translation.md`) split heavy detail into `docs/references/<topic>-<sub>.md`. `docs/DOC-MAINTENANCE.md` owns the truth discipline: *"if you can't `git grep` it on this branch, don't claim it"*, git-aware verification commands (plain `rg`/`ls` also match untracked files, so unmerged work masquerades as shipped), and a one-shot runnable check block covering each concrete claim type plus relative-link integrity.
- **Layer 3 — verification.** `docs/verification.md`: throwaway scratch scripts under `e2e/scratch/` (git-ignored) reuse the permanent E2E fixtures to drive the real built extension; evidence lands in git-ignored `test-results/verify/<scenario>/` with a `report.md`; cheap signals (typecheck, unit tests) run first; a scratch repro of a bug is the "confirm it exists" step, then gets promoted to a failing committed test.
- **How-doc.** `docs/develop.md` owns commands, style and language conventions, testing mechanics, and commit/PR rules: single-purpose commits starting with a gitmoji emoji (the emoji drives changelog grouping), PR template with linked issues, and a review policy of judging the diff, not the description.

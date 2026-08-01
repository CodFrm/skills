# Ready-made recipes: TypeScript / React

> The method for building guardrails is in [`lint-harness.md`](./lint-harness.md). This file is code you can copy directly.
>
> **Copy each block together with its guard test.**

## 1. Ban literal colours (the design token guardrail)

Two implementations; choose by how much precision you need.

### 1a. Lightweight — pure configuration, no custom rule file

`no-restricted-syntax` + a regex. Suits a project that has just established a token system and wants a guardrail up quickly.

```js
// eslint.config.js
const paletteColors =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const paletteClassPattern = `(^|[^-\\w])(text|bg|border|ring|fill|stroke)-(${paletteColors})-[0-9]{2,3}([^-\\w]|$)`;
const paletteMessage =
  "Do not write palette class names; use a semantic token (text-warning / bg-background / …, " +
  "defined in src/styles/globals.css) — one colour defined in one place is what makes both " +
  "light and dark themes hold (docs/design.md → Core Constraints).";

const paletteRestrictions = [
  { selector: `Literal[value=/${paletteClassPattern}/]`, message: paletteMessage },
  { selector: `TemplateElement[value.raw=/${paletteClassPattern}/]`, message: paletteMessage },
];

export default tseslint.config(
  // …
  {
    // Scope: effective only in directories sharing the same token set.
    // A separately embedded subpackage that does not share tokens is excluded — write down why.
    files: ["src/**/*.{ts,tsx}", "packages/ui/src/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", ...paletteRestrictions] },
  },
  {
    // The guard test itself has to contain violating fixture strings, so exempt it.
    files: ["src/__tests__/eslint-harness.test.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
);
```

**Note**: both the `Literal` and `TemplateElement` selectors are needed — with only the former, `` className={`bg-red-500 ${x}`} `` slips through.

### 1b. Precise — a custom rule

Use this when you need to cover arbitrary hex values (`bg-[#fff]`) and variant prefixes (`dark:` / `hover:`) at the same time, and to report a precise location.

```js
// eslint-rules/no-raw-color-classname.mjs
// Bans writing raw palette/hex colours directly in className.
// Design tokens are mandatory, because only they respond correctly to both light and dark themes.
// For a genuine exception (a QR code with a fixed white background, say), use
// eslint-disable-next-line with a stated reason.

const TAILWIND_PALETTES = [
  "white", "black", "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple",
  "fuchsia", "pink", "rose",
].join("|");

const COLOR_PREFIXES = [
  "bg", "text", "border", "ring", "fill", "stroke", "divide",
  "from", "via", "to", "outline", "decoration", "placeholder",
  "caret", "accent", "shadow", "ring-offset",
].join("|");

// Supports bg-red-500 / border-white / dark:bg-gray-800 / hover:text-red-500.
// Not handling the opacity suffix is deliberate: bg-red-500/20 hits the bg-red-500 part first.
const PALETTE = new RegExp(
  `(?:^|[^\\w-])((?:[\\w-]+:)*(?:${COLOR_PREFIXES})-(?:${TAILWIND_PALETTES})(?:-\\d{1,3})?)(?=$|[^\\w-])`
);

// Arbitrary hex values, e.g. bg-[#fff] / dark:border-[#ffffffcc]
const ARBITRARY_HEX = new RegExp(
  `(?:^|[^\\w-])((?:[\\w-]+:)*(?:${COLOR_PREFIXES})-\\[#[0-9a-fA-F]{3,8}\\])(?=$|[^\\w-])`
);

export default {
  meta: {
    type: "problem",
    docs: { description: "bans raw colours in className; design tokens are mandatory" },
    schema: [],
    messages: {
      rawColor:
        "Do not use the raw colour `{{ cls }}`. Use a design token (bg-background / " +
        "text-foreground / …, defined in src/index.css) — one colour defined in one place is " +
        "what makes both light and dark themes hold. See docs/design.md.",
    },
  },
  create(context) {
    function check(node, text) {
      const hit = PALETTE.exec(text) ?? ARBITRARY_HEX.exec(text);
      if (hit) context.report({ node, messageId: "rawColor", data: { cls: hit[1] } });
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};
```

---

## 2. i18n guardrails

### 2a. Ban hardcoded source-language text

`eslint-plugin-i18next`. The crux is `words.exclude` — **ban only the source language, without hitting English identifiers**:

```js
import i18next from "eslint-plugin-i18next";

export default tseslint.config(
  i18next.configs["flat/recommended"],
  {
    rules: {
      "i18next/no-literal-string": ["error", {
        mode: "jsx-only",
        "jsx-components": { exclude: ["Trans", "code", "pre", "script", "style"] },
        // Visible attributes are covered too — they appear on screen just the same
        "jsx-attributes": {
          include: ["aria-label", "aria-description", "title", "placeholder", "alt"],
        },
        words: {
          exclude: [
            "[0-9!-/:-@[-`{-~]+",        // pure symbols and digits
            "[A-Z_-]+",                   // constant names
            /^\p{Emoji}+$/u,              // pure emoji
            /^[^\p{Script=Han}]*$/u,      // ← the key: allow every string containing no Han characters
          ],
        },
      }],
    },
  },
  {
    // Fixtures in tests need to contain hardcoded text
    files: ["src/**/__tests__/**/*.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    rules: { "i18next/no-literal-string": "off" },
  },
);
```

> The example above assumes a Chinese source language. When it is something else, replace `\p{Script=Han}` with the corresponding Unicode script, or switch to an allow-list of permitted language characters.

### 2b. Ban `t(key, { defaultValue })`

**Why this deserves its own rule**: an i18n library returns `defaultValue` verbatim when the key is missing, leaking hardcoded text into every language; worse, the script validating key completeness usually skips calls carrying a `defaultValue` — **so this form bypasses CI's key check and lets missing keys go silently untranslated**.

```js
// eslint-rules/no-i18n-default-value.mjs
const T_OBJECT_NAMES = new Set(["i18n", "i18next"]);

function unwrap(node) {
  let cur = node;
  while (
    cur?.type === "ChainExpression" ||
    cur?.type === "TSAsExpression" ||
    cur?.type === "TSNonNullExpression"
  ) cur = cur.expression;
  return cur;
}

function isTranslationCallee(callee) {
  const node = unwrap(callee);
  if (node?.type === "Identifier") return node.name === "t";
  if (node?.type !== "MemberExpression") return false;
  const prop = node.property;
  const name = prop?.type === "Identifier" ? prop.name : prop?.value;
  if (name !== "t") return false;
  const obj = unwrap(node.object);
  return obj?.type === "Identifier" && T_OBJECT_NAMES.has(obj.name);
}

export default {
  meta: {
    type: "problem",
    docs: { description: "bans the inline defaultValue fallback on t()" },
    schema: [],
    messages: {
      noDefault:
        "Do not write t(key, { defaultValue }) — on a missing key it falls back silently and " +
        "bypasses CI's key check. Add the key to every locale file and write a bare t(key) at " +
        "the call site.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isTranslationCallee(node.callee)) return;
        const opts = node.arguments[1];
        if (opts?.type !== "ObjectExpression") return;
        const hit = opts.properties.some(
          (p) => p.type === "Property" &&
            (p.key?.name === "defaultValue" || p.key?.value === "defaultValue")
        );
        if (hit) context.report({ node, messageId: "noDefault" });
      },
    };
  },
};
```

### 2c. The key completeness script

Better suited than lint to **cross-file consistency**: every `t("ns:key")` literal in the source resolves in each locale file, and conversely the keys line up between locale files.

- Written as a standalone script (`scripts/check-i18n.mjs`), wired into the `lint` command.
- **The script needs its own tests too** (`scripts/check-i18n.test.mjs`) — it is a guardrail, and it rots just the same.
- When wiring it into pre-commit, **check the git index snapshot** rather than the working tree (see [`lint-harness.md`](./lint-harness.md#check-the-snapshot-in-the-git-index-not-the-working-tree)).

---

## 3. Force use of the wrapper

```js
rules: {
  // Ban an import: a library's export must go through the project wrapper
  "no-restricted-imports": ["error", {
    paths: [{
      name: "sonner",
      importNames: ["toast"],
      message: "Business code uses notify (@/components/ui/toast); do not import sonner's toast directly.",
    }],
  }],

  // Ban a property access: a method must go through the wrapper
  "no-restricted-properties": ["error", {
    object: "toast",
    property: "success",
    message:
      "Use notifySuccess/notifyCopied from src/lib/notify.ts (top-center) — " +
      "a bottom success toast covers the terminal/output view (#135, see AGENTS.md).",
  }],
}
```

**The crux**: the sanctioned wrapper itself (and its tests) is the **only** exemption, and that exemption goes in the configuration rather than an inline disable:

```js
{
  files: ["src/lib/notify.ts", "src/__tests__/notify.test.ts"],
  rules: { "no-restricted-properties": "off" },
}
```

> Note the `(#135)` in the error message — **include that issue number**.

---

## 4. Guard tests (required)

**Run by loading the project's real eslint configuration** — that verifies not just the rule's logic but that "the rule really was wired into the configuration with the right severity and scope".

```ts
// src/__tests__/eslint-harness.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { Linter } from "eslint";
import config from "../../eslint.config.js";

// These rules are mechanical guardrails: they pin the constraints in AGENTS.md that otherwise
// rely on human memory into lint.
// Running the Linter against the real configuration verifies both the rule's logic and that it
// really was wired into the configuration.

// Type-aware lint blocks require files that genuinely exist in the TS project, whereas the
// fixtures here are in-memory and virtual. The guardrail rules are all purely syntactic (AST)
// and do not depend on type information, so drop the type-aware blocks.
const syntaxOnly = config.filter((e) => !e?.languageOptions?.parserOptions?.projectService);
const linter = new Linter({ configType: "flat" });

function ruleIdsAt(code: string, filename: string) {
  const messages = linter.verify(code, syntaxOnly, { filename });
  const fatal = messages.find((m) => m.fatal);
  if (fatal) throw new Error(`fixture failed to parse (${filename}): ${fatal.message}`);
  return messages.map((m) => m.ruleId);
}

describe("guardrail lint rules", () => {
  // The first verify has to parse the whole flat config, which is a costly cold start; warm it
  // up once to avoid intermittent timeouts.
  beforeAll(() => ruleIdsAt("const x = 1;", "src/pages/foo.tsx"));

  describe("ban literal colours", () => {
    const RULE = "no-restricted-syntax";

    // ① violations must be reported — every variant gets covered
    it.each([
      ['<div className="bg-red-500" />', "palette class name"],
      ['<div className="dark:bg-gray-800" />', "with a variant prefix"],
      ["const c = `bg-blue-500 ${x}`;", "template string"],
      ['<div className="bg-[#fff]" />', "arbitrary hex value"],
    ])("catches %s (%s)", (code) => {
      expect(ruleIdsAt(code, "src/pages/foo.tsx")).toContain(RULE);
    });

    // ② compliant code must not be reported — false positives are the number one cause of a
    //    guardrail being deleted
    it.each([
      '<div className="bg-background text-foreground" />',
      '<div className="bg-primary/90 hover:bg-primary" />',
      '<div className="rounded-lg border-border" />',
    ])("allows %s", (code) => {
      expect(ruleIdsAt(code, "src/pages/foo.tsx")).not.toContain(RULE);
    });

    // ③ directories outside the scope must not be hit
    it("a subpackage not sharing tokens is not bound by this rule", () => {
      const ids = ruleIdsAt('<div className="bg-red-500" />', "packages/devserver-ui/src/a.tsx");
      expect(ids).not.toContain(RULE);
    });
  });
});
```

### The three directions that must be covered

| Direction | Assertion | Why |
|---|---|---|
| ① violations reported | `toContain(RULE)` | The rule's logic is correct **and** it is wired into the configuration at error severity |
| ② compliant code not reported | `not.toContain(RULE)` | **False positives are the number one cause of a guardrail being deleted** |
| ③ exemptions not reported | Use an exempted path as the filename | The scope configuration is correct |

### Verify manually once before delivering

Comment the rule out of `eslint.config.js` → run the guard test → **confirm it goes red** → restore.

Without it a guard test can stay green while reporting nothing at all, because of a config filter, a file name that does not match, or a misspelled rule name.

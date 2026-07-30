# Building a UI mockup

The judgements that decide *whether* and *on what basis* are in [SKILL.md](../SKILL.md#ui-and-html-mockups); this file is the mechanism.

Everything here lands in `.dev-kit/artifacts/<spec-slug>/mockups/` — gitignored, local, and **never** in the project root: prototype dependencies do not belong in the product.

## Where to build it — cheapest first, and none of these write into the project

1. **The project already has a component preview** (Storybook and friends): use it. Real tokens, real components, nothing installed.
2. **A front end but no preview**: a small app in `mockups/app/` that **imports the project's real components and token stylesheet** rather than reinstalling a design system. Because `.dev-kit/` sits inside the repository root, module resolution walks up and finds the project's `node_modules` on its own — no install, and the product's `package.json` stays untouched.
3. **No front end worth borrowing from, or the visual question is small**: minimal self-contained HTML.
4. **A separate package with its own install**: last resort, only when the design system genuinely cannot be imported in place (a private registry, a build step the mockup cannot run). It costs an install per spec slug and drifts from the product from day one.

**What option 2 needs in its own config** — a few lines, because this is the only thing here that can drift: an alias pointing at the project's component directory; the same Tailwind / PostCSS content globs; on Vite, `server.fs.allow` widened to the repository root.

**Under pnpm this reaches the project's direct dependencies only**, which is enough for a design system. A transitive import failing to resolve is the signal to **declare it in the spec**, not to start installing into the mockup.

## When there is no dev server that can actually run

Some projects cannot serve a prototype live — it needs a backend, credentials or a device. Build once to a static bundle and browse it with `devkit serve`: you lose hot reload, not fidelity. (`file://` will not do — it blocks ES module imports on origin grounds.)

**`devkit serve`** is dev-kit's optional CLI: a read-only static server over `docs/specs/` and `.dev-kit/artifacts/`. Inside a Claude Code session it is on PATH; otherwise run `node "<dev-kit root>/bin/devkit" serve`. **`command not found` is not a verdict that there is no CLI** — only the full command failing to run is.

- **Point `outDir` at `mockups/` itself, not a nested `dist/`.** The file listing skips `dist` / `build` / `out`, so a bundle in there is reachable by URL yet invisible in the sidebar.
- **Keep asset references relative** (`base: './'` on Vite), since the artifact is served from a nested path.
- **No CDN in a self-contained mockup** (`cdn.tailwindcss.com`, unpkg): the CSP `devkit serve` gives artifacts is `default-src 'self'`, so a CDN gives you a blank page. For a design system, use option 1 or 2.

## What the mockup has to cover

The main flow, the empty state, the loading state, the error state, a narrow viewport, and keyboard focus. **States that do not apply get a stated reason in the spec** — silent omission reads identically to having forgotten them.

Do not copy production source or real data into an artifact.

## `mockups/README.md`

Record the start command, which project components and tokens it imports, a note on the fictional data, and the known non-functional items. **The line between what is real and what is faked is the useful part** — it tells whoever implements this which parts only look settled.

## Sharing it

Present it with an existing preview service or the project's dev server; without one, `devkit serve` browses the artifact.

A mockup serves this machine only. To send it elsewhere, **zip the whole `mockups/` directory** — which is why every reference inside must be relative — or send screenshots. The decision rests on the sentence you wrote about what this version determines, not on the file.

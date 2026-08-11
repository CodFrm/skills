# Building a UI mockup

[SKILL.md](../SKILL.md#ui-and-html-mockups) decides when to build one. Store it under `.dev-kit/artifacts/<spec-slug>/mockups/`; do not modify product dependencies or source.

## Choose the cheapest runnable form

1. Existing component preview.
2. Small artifact app importing the project's real components and token stylesheet through project module resolution.
3. Self-contained HTML for a small visual question.
4. Separate artifact package/install only when the design system cannot run through the earlier forms.

For an artifact app, configure only the required component alias, CSS/Tailwind content roots and dev-server filesystem allowance. Do not install transitive product dependencies into the artifact.

If the product cannot serve a preview, build a static bundle and run `devkit dashboard` (or `node "<dev-kit root>/bin/devkit" dashboard`). `file://` blocks ES module imports, so a static mockup preview needs the dashboard. Keep asset paths relative and output directly under `mockups/`, not `dist/`/`build/`/`out/`. Do not rely on CDNs.

Cover the main, loading, empty, error, narrow-viewport and keyboard-focus states that apply. Use fictional data only.

Add `mockups/README.md` with the start command, imported product tokens/components, fictional-data note, and non-functional/faked boundaries. Present through the existing preview or `devkit dashboard`; share the whole directory or screenshots, never an isolated file with broken relative assets.

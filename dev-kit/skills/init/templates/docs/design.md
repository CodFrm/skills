<!--
Template: docs/design.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, delete any
section you do not need, and delete this comment block at the end.
This file owns "the design system": token values and semantics, the theming mechanism, the
component palette, layout/motion/state patterns, where explanatory copy lives, the new-page
recipe.
It does not own: the lint rules enforcing them (those are in the lint config + develop.md), or
internal architecture (architecture.md).

Conditional sections:
  - The i18n sections — delete entirely if the project has no i18n
  - The mobile / responsive sections — delete entirely for a desktop application or a fixed viewport
  - The light/dark theme sections — simplify when there is only one theme
Split any subsection exceeding ~80 lines into docs/references/design-<topic>.md, leaving a
summary + link in the main document.

⚠️ This template is written in React + Tailwind vocabulary (className, dark: variants, hover:/
   focus-visible: pseudo-class utilities, CVA variants, motion-reduce:, the rounded-*/shadow-*
   ladders) because that is the most common shape. On any other stack — Vue + SCSS, Svelte,
   SwiftUI, Flutter, Qt, plain CSS — **the constraints survive and the expression does not**:
   one source for every colour value, both themes first-class, no ad-hoc colour or font,
   loading/empty/error/success on every async flow, restrained and reduce-motion-aware
   animation, explanation attached to its control, reuse before building. Keep the entry, then
   rewrite its concrete form in the project's own idiom (scoped styles + CSS variables, a theme
   struct, a ThemeData, a QSS palette) and lift the examples from real code per
   references/filling-templates.md. Do not leave a Tailwind class name in a repository that has
   no Tailwind — that is the "wrong example in an authoritative voice" this skill warns about.

⚠️ The token table's values get copied entry by entry from the token definition file (count,
   naming and both the light and dark columns all enumerated on the spot; writing them from
   memory is this document's most common accident); the page skeleton example gets lifted from a
   well-written page that already exists in the project, with the business detail removed and
   the structure kept. How to source them is in the skill's references/filling-templates.md.
-->

# <project name> design system

> **A design reference built for reuse.** It gathers the visual language scattered across <the token definition file> and the component layer into one place for you to copy from: **colour tokens (with full light and dark values), the theming mechanism, the component palette, layout and responsiveness, motion, state patterns, where explanation goes, and an end-to-end new-page recipe.** Read it before creating or modifying any page, dialog or section, so that what you produce is visually and behaviourally consistent with the rest of the application.

> **The stack in one line:** <framework + version / component library / CSS approach / router>. Colours and motion are defined in <block name> in <file path>. <Key facts about the configuration, e.g.: there is no tailwind.config.js; class names have no prefix>.

---

## What this file owns

| Owned here | Owned elsewhere |
| --- | --- |
| Colour token values, semantics and usage | The hard rules **enforcing** them (lint bans, mandatory wrappers) → [`develop.md`](./develop.md) |
| The theming mechanism, how to use dark variants | Commands, directory structure, code style, testing, the commit flow → [`develop.md`](./develop.md) |
| The component palette, variants, how to choose | Layering, dependency direction, internal implementation → [`architecture.md`](./architecture.md) |
| Layout and responsiveness, stacking (z-index), elevation (shadows), motion, state patterns, where explanatory copy lives, accessibility, the new-page recipe | Documentation maintenance and fact-checking → [`documentation.md`](./documentation.md) |

This file **restates** `develop.md`'s hard rules only where necessary and then links back — it does **not copy** their content.

---

## Core Constraints (non-negotiable)

**Every UI change must satisfy all of the following.** They are the pass mark for "consistent, friendly UI/UX" in this codebase.

- **Use tokens, never literal colours — one value defined in one place.** Never write hex (`#1296db`), `rgb()` or palette class names (`text-blue-500`). Always use a semantic token — <list the common ones: background/foreground/border/primary/muted text>. Every colour value lives in exactly one place (<the token definition file>), which is what keeps the palette consistent and lets **one edit re-skin the whole application**.
  **One semantic concept maps to one token**: before adding a new colour, look in the [token table](#colour-tokens-full-light-and-dark-values) for an existing one to reuse, and **do not introduce near-duplicates** (a second slightly different grey, a second slightly different blue). Add a token only when the concept **genuinely is new**, and then it must carry **both a light and a dark value** and be recorded in this document.

  <!-- The exemption list: a constraint with no exemption list gets quietly broken. Where there
       are exceptions, list them here one by one with reasons. -->
  > **Sanctioned literal-colour exceptions** (everything else uses tokens): <e.g. the terminal ANSI palette — the terminal library cannot consume CSS variables>; <e.g. neutral black translucent shadows/overlays — this design system deliberately has no shadow token>. **A new exception gets written in here with its reason**, rather than being disabled in place.

- **Both themes are first-class citizens.** <!-- Delete this when there is only one theme --> Because every colour comes from a token that has both a light and a dark value, using tokens gives theme correctness for free. **Look at it under real light and real dark before reaching a verdict.**

- **<Mobile / narrow viewport> is a different shell, not a shrunken desktop.** <!-- Delete this for a desktop application --> The UI switches shell at <breakpoint>: <side navigation → bottom tabs + drawer; tables → cards; rows → vertical stacks; actions → a sticky bottom action bar>. **A feature that cannot be used at a narrow viewport is not finished.**

- **No inline styles for anything Tailwind/CSS can express.** Compose class names with <cn() and similar utilities>, and build variants with <CVA and similar>. Inline styles are reserved for genuinely dynamic values (a computed width, a per-item colour variable).

- **hover/focus are CSS, not state.** Express interaction visuals with pseudo-classes (`hover:…`, `focus-visible:ring-…`). React state is for data and logic, **not for styling**.

- **Reuse first, then build new.** Default to the base components in <the component directory>; icons come only from <the icon library>; do not hand-roll a control that already exists. Beyond the base components, search the existing pages for a **composite block** that already does this (a card row, an identity header, a status screen …) and reuse it. **When the same block appears in two or more places, extract it into a shared component** rather than copy-pasting — one concept, one implementation, is what keeps behaviour and styling from drifting and what makes one fix apply everywhere.

- **Restrained motion.** Enter/exit at <150–250ms>, `ease-out`; reuse the existing animation utility classes rather than writing `@keyframes` in place; prefer `transition-colors` over `transition-all`. **Every animation carries a `motion-reduce:` treatment**, respecting the system's "reduce motion" preference.

- **No silent operations.** Every async flow presents **loading / empty / error / success** (plus progress for a long task). The user must always know whether their action worked.

- **Explanation attaches to the thing it explains — it is not laid out on the page.** Definitions, background, "how this works", why a default is what it is, what a value means: these hang off the control they belong to via <the tooltip / popover component>, not as a paragraph of prose above the content. Paragraphs of guidance push the actual interface below the fold, get read once and never again, and are the first thing to go stale. **Only what the user needs in order to act stays inline** (format, unit, constraint, consequence). The full ladder and the rules for reaching them by keyboard and by touch are in the [explanation surfaces](#explanation-surfaces-inline-tooltip-popover) section.

- **All visible text goes through i18n.** <!-- Delete this when there is no i18n --> New text uses `<the t function>` and updates <the locale file paths> at the same time. Do not hardcode <the source language> (lint catches it). Do **not** translate dynamic content (user input, terminal output, markdown, logs). The details are in [`develop.md`](./develop.md).

- **Do not add a new colour or a new font ad hoc.** A new colour → add a token in <the token definition file> (with both light and dark values) and record it in this document. A new font → add a `--font-*` token, and **do not reference a font family that is not configured** (it falls back silently and misleads).

---

## Design principles (the why behind the constraints)

Apply these when shaping an interface:

1. **<Principle one: e.g. "trust first, clear hierarchy">** — <expand: give the most important information the visual weight; order a decision page as identity → permissions → detail>.
2. **System state is always visible.** No silent work. Every async flow presents **progress → process → result**.
3. **Colour is semantic, not decorative.** <Blue = interactive/primary; green = safe/success; amber = caution/sensitive; red = danger/error>. Colour carries meaning.
4. **<Principle four: e.g. "mobile is a different shell" / "one desktop window frame">** — <expand>.
5. **A consistent shell.** The main pages share one skeleton: <a sticky top bar + a single scroll container + a sticky bottom action bar>. Change the content, not the frame.
6. **The interface is the explanation.** Something needing a paragraph to be usable is a design problem, not a copy problem — fix the labels, the ordering and the defaults first. What genuinely remains gets attached to its control, not spread across the page.
7. **High cohesion, low coupling.** Each UI unit has one purpose and one clear interface, and can be understood and tested on its own. **A file growing is usually the signal to split it.**

---

## The theming mechanism

<!-- With only one theme, reduce this section to "where the colours are defined and how to change
     them" -->

**The mechanism:** <describe: e.g. toggled by adding/removing a .dark class on documentElement; every token is defined once under :root and once under .dark, so switching the class re-skins the whole application without components changing any colour>.

**Provider / entry point:** <file path>

**Flash prevention:** <file path> reads <the storage key> and sets the theme class **before** the framework mounts, so a refresh never flashes the wrong theme for a frame. **New page entry points reuse the existing mounting pattern** rather than writing their own theme logic.

**Correct usage:**

```<language>
// ✅ tokens — adapt to light and dark automatically
<container className="bg-card text-foreground border-border">…</container>

// ✅ the dark: variant is only for dark-specific fine-tuning
<container className="bg-input/30 dark:bg-input/50">…</container>

// ❌ hardcoded colours — guaranteed to break in dark, and violates Constraint 1
<container className="bg-white text-[#1a1a1a] border-[#e5e5e5]">…</container>
```

---

## Colour tokens (full light and dark values)

**The single source:** <the token definition file>.

**Usage:** background `bg-<token>`, text `text-<token>`, border `border-<token>`, focus ring `ring-ring`. Opacity modifiers compose directly (`bg-primary/90`). **Never hardcode a colour value.**

### Base surfaces and text

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `background` | `<#>` | `<#>` | Page background |
| `foreground` | `<#>` | `<#>` | Primary text |
| `card` | `<#>` | `<#>` | Cards / surfaces |
| `muted-foreground` | `<#>` | `<#>` | Secondary / descriptive text (**must meet AA contrast**) |
| `border` | `<#>` | `<#>` | Global borders |
| `ring` | `<#>` | `<#>` | Focus rings |

### Brand primary

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `primary` | `<#>` | `<#>` | Brand text, icons, borders, active-state emphasis |
| `primary-foreground` | `<#>` | `<#>` | Text/icons on a primary fill |

### Status colours

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `destructive` | `<#>` | `<#>` | Danger / delete / error |
| `success` | `<#>` | `<#>` | Success / enabled / running (solid) |
| `warning` | `<#>` | `<#>` | Caution / sensitive (solid) |

> The solid status colours are for icons and dots; **badges use paired "light background + dark text" tokens** (`*-bg` / `*-fg`) rather than laying a solid colour down as a background.

<!-- Add a section when there is a categorical/identity colour system, stating that "the hash is
     implemented in exactly one place" and giving that function's location -->

---

## Typography and radii

### Typography

<State the font strategy and the reason. E.g.: system fonts only, zero webfonts — it must work offline, must not make requests to a CDN (privacy + CSP), and every byte has a cost.>

| Token | Value | Purpose |
| --- | --- | --- |
| `font-sans` | `<font stack>` | Body / UI text |
| `font-mono` | `<font stack>` | Code, version numbers, numeric values |

<!-- Keep this for projects with a CJK source language -->
> Both font stacks end with an **explicit CJK fallback**, because <project> is <CJK language>-first and CJK coverage has to be controlled rather than left to whatever `system-ui` resolves to on a non-<CJK language> system.

> **Do not reference a font family that is not genuinely bundled** — it falls back silently and misleads (the "do not add a new font ad hoc" constraint). If a brand font genuinely is needed, self-host it, keep the CJK fallback, and update this table.

### Radii

`<the --radius base value>`, deriving several steps:

| Class | Value | Typical use |
| --- | --- | --- |
| `rounded-sm` | `<>` | Small tags, compact controls |
| `rounded-md` | `<>` | Buttons, inputs |
| `rounded-lg` | `<>` | Cards, panels |
| `rounded-xl` | `<>` | Large cards, dialogs |

### Spacing and width rhythm

- <Content width steps>
- <Sticky top bar / action bar heights>
- <Starting values for section spacing and card padding>

---

## Elevation (shadows) and stacking (z-index)

**A shadow says how high a surface floats. Pick from this fixed ladder rather than letting it drift:**

| Level | Class | Purpose |
| --- | --- | --- |
| **At rest** | none / `shadow-sm` | Flat cards and list rows sitting on the page. **Prefer a border over a shadow at rest.** |
| **Raised** | `shadow-md` | Floating layers anchored to a trigger — dropdowns, popovers, pickers. |
| **Overlay** | `shadow-lg` | Detached layers owning the screen — dialogs, drawers. |

- **Do not go beyond `shadow-lg`.** Bigger shadows read as heavy and inconsistent; when stronger separation genuinely is needed, what you need is usually a scrim, not a bigger shadow.
- **Shadows are nearly invisible in dark.** Depth in dark comes from **surface colour steps + borders**, not from shadows.

**The z-index ladder:** <e.g. z-10 page chrome / z-50 overlays>. **Do not write magic `z-[999]`.**

---

## Motion

- Enter/exit at <150–250ms>, `ease-out`.
- Reuse <existing animation utility classes / data-state driven animation> rather than writing keyframes in place.
- Prefer `transition-colors` / `transition-transform` over `transition-all`.
- **Every animation carries a `motion-reduce:` (or `motion-safe:`) modifier**, respecting the system's reduce-motion preference.
- Motion serves **understanding a state change** (where it came from, where it went), not decoration. When in doubt, remove it.

---

## State patterns

**Every async flow must cover these four states**, and missing any one means it is not finished:

| State | How it is presented |
| --- | --- |
| Loading | <skeleton / top progress bar / button loading state> |
| Empty | <the empty-state component + one line of "what to do next"> |
| Error | <a specific error message + an actionable next step, not "something went wrong"> |
| Success | <toast / in-place state change> |

<!-- Keep this when there is a notification wrapper convention, and state the why -->
> **Success messages always go through `<the wrapper function>`**, not `<the underlying toast>` directly. The reason: <e.g. a bottom toast covers the terminal/output view>. *Enforced by lint (see <lint config>); the only exemption is the wrapper itself and its tests.*

---

## Explanation surfaces: inline, tooltip, popover

**The page shows the thing; the explanation hangs off it.** Pick the surface by what the reader needs, not by what is easiest to type:

| What the copy is | Where it goes | Component |
| --- | --- | --- |
| **Needed in order to act** — format, unit, allowed range, what the action will do | **Inline**, under the control, always visible | `<the field description / hint slot>` |
| What a term, column, badge or value means; a one-line "why this default" | **Tooltip**, on hover *and* focus, ≤ <one short sentence> | `<Tooltip>` |
| Several lines, a list, a link, or anything interactive | **Popover**, opened by an explicit `<?>`/info trigger, dismissible | `<Popover>` / `<HoverCard>` |
| Applies to the whole page or the whole flow | Linked out to the docs **once**, not restated per section | `<the docs link pattern>` |
| What just went wrong and what to do about it | The error state itself, next to the thing that failed | See [state patterns](#state-patterns) |
| Nothing to show yet | The empty state's one line of "what to do next" — **there the copy *is* the content** | `<the empty-state component>` |

**Rules that decide the argument:**

- **Nothing a user must have in order to act may live only behind hover.** Hover does not exist on touch, dismisses without warning, and is invisible to anyone scanning the page. If the task fails without that sentence, it is inline text.
- **A tooltip trigger is a real control**: keyboard focusable, opening on focus as well as hover, closing on `Esc`, and wired to its content with `aria-describedby` (`aria-label` when the trigger is icon-only). The `title` attribute is **not** a tooltip — it cannot be styled, appears after a delay you do not control, and is skipped by some screen readers.
- **Touch has no hover**: <state the behaviour on this stack — e.g. `<Tooltip>` opens on tap and closes on the next outside tap; below <breakpoint> it degrades to `<Popover>`>. A tooltip only reachable by hover does not exist on mobile.
- **No tooltip on a `disabled` control** — a disabled element fires no pointer events, so the tip never opens. Wrap the trigger in an enabled element, or put the reason for the disabling beside it.
- **One explanation, one home.** The same sentence in a tooltip *and* in the paragraph above it means both will drift; delete the paragraph.
- **Do not explain what the interface already says.** A tooltip reading "Save — saves the form" is noise that trains people to ignore every other tooltip.
- **Explanation is content, so it goes through i18n and gets room to stretch** — a tooltip that fits <the source language> can be twice as long elsewhere. <!-- Delete when there is no i18n -->

<!-- Fill in when the project has a settled convention, e.g. "every table column header carrying
     a computed metric has an info tooltip giving the formula" -->
> **Existing conventions in this project:** <where the tooltip pattern is already used and what for; the component's path>.

---

## Accessibility

- **AA contrast** under both themes.
- **Meaning is never carried by colour alone** — pair it with an icon, text or a shape.
- Custom controls must be **keyboard reachable**, with a visible focus ring.
- Icon buttons must have an `aria-label`.
- <Minimum touch target size>.
- Respect "reduce motion".

---

## The new page / new section recipe

When creating a page or a dialog, work through this checklist:

- [ ] **The entry point** reuses the existing mounting pattern (theme Provider, Toaster …), with no bespoke theme logic.
- [ ] **The shell** uses the shared skeleton: <sticky top bar + a single scroll container + sticky bottom action bar>.
- [ ] **Responsiveness**: switch shell at <breakpoint> rather than shrinking (Constraint). <!-- Delete for a desktop application -->
- [ ] **Colours** all come from tokens, with no literal colours, and **both themes have actually been looked at**.
- [ ] **Components** reuse first: search for an existing composite block → then base components → extract a shared component on the second repetition.
- [ ] **Hierarchy** puts the most important information first.
- [ ] **Explanation** hangs off the control it explains (tooltip / popover), with **nothing needed to act living behind hover only**, and no paragraph of guidance dropped onto the page.
- [ ] **States**: loading / empty / error / success all covered, never silent.
- [ ] **Motion** restrained, hover/focus via pseudo-classes, with `motion-reduce:`.
- [ ] **Elevation** from the fixed ladder, **stacking** from the fixed z-index steps, with no magic values.
- [ ] **Accessibility**: AA contrast, meaning not carried by colour alone, keyboard reachable, icon buttons labelled.
- [ ] **Text** goes through i18n, **with room to stretch for longer languages**. <!-- Delete when there is no i18n -->

The page skeleton (tokens + existing base components + the shared shell):

```<language>
<a minimal, directly copyable page skeleton>
```

---

## Sources and verification

**The implementation's sources of truth (read/edit these when changing the design):**

- Colour / motion tokens → <file path>
- Theming → <file path>
- Base components → <directory path>
- <The class-merging utility / the breakpoint hook> → <file path>

**Related documents:** enforced rules and the commit flow → [`develop.md`](./develop.md); internal implementation → [`architecture.md`](./architecture.md); documentation maintenance → [`documentation.md`](./documentation.md).

> When editing this document, follow [`documentation.md`](./documentation.md): **token values, component names and variant names must match the code on the current branch (if `git grep` cannot find it on this branch, do not write it in)**; enumerate counts and lists on the spot rather than from memory.

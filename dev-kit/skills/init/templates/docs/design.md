<!--
Template: docs/design.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, delete any
section you do not need, and delete this comment block at the end.
Owns: token values and semantics, the theming mechanism, the component palette, layout/motion/
state patterns, where explanatory copy lives, the new-page recipe.
Does not own: the lint rules enforcing them (lint config + develop.md), internal architecture
(architecture.md).

Conditional sections: delete the i18n sections with no i18n; delete the mobile/responsive
sections for a desktop application; simplify the theme sections when there is only one theme.
Split any subsection over ~80 lines into docs/references/design-<topic>.md.

⚠️ Written in React + Tailwind vocabulary because that is the most common shape. On any other
   stack **the constraints survive and the expression does not**: one source for every colour,
   both themes first-class, no ad-hoc colour or font, loading/empty/error/success on every async
   flow, reduce-motion-aware animation, explanation attached to its control, reuse before
   building. Rewrite each entry in the project's own idiom and lift examples from real code per
   references/filling-templates.md. **Never leave a Tailwind class name in a repository with no
   Tailwind.**

⚠️ The token table's values get copied entry by entry from the token definition file — count,
   naming and both columns enumerated on the spot, because writing them from memory is this
   document's most common accident. The page skeleton gets lifted from a well-written page that
   already exists.
-->

# <project name> design system

> **A design reference built for reuse.** It gathers the visual language scattered across <the token definition file> and the component layer into one place: **colour tokens with full light and dark values, the theming mechanism, the component palette, layout and responsiveness, motion, state patterns, where explanation goes, and a new-page recipe.** Read it before creating or modifying any page, dialog or section.

> **The stack in one line:** <framework + version / component library / CSS approach / router>. Colours and motion are defined in <block name> in <file path>. <Key configuration facts.>

## What this file owns

| Owned here | Owned elsewhere |
| --- | --- |
| Colour token values, semantics and usage | The hard rules **enforcing** them (lint bans, mandatory wrappers) → [`develop.md`](./develop.md) |
| The theming mechanism, dark variants | Commands, structure, code style, testing, the commit flow → [`develop.md`](./develop.md) |
| The component palette, variants, how to choose | Layering, dependency direction, internal implementation → [`architecture.md`](./architecture.md) |
| Layout, responsiveness, stacking, elevation, motion, state patterns, explanatory copy, accessibility, the new-page recipe | Documentation maintenance and fact-checking → [`documentation.md`](./documentation.md) |

This file **restates** `develop.md`'s hard rules only where necessary and links back; it does not copy them.

## Core Constraints (non-negotiable)

**Every UI change must satisfy all of these.**

- **Use tokens, never literal colours — one value defined in one place.** No hex (`#1296db`), no `rgb()`, no palette class names (`text-blue-500`); always a semantic token — <list the common ones>. Every colour value lives in <the token definition file>, which is what lets **one edit re-skin the whole application**. **One semantic concept maps to one token**: check the [token table](#colour-tokens-full-light-and-dark-values) before adding a colour, and **do not introduce near-duplicates**. A genuinely new concept gets a token carrying **both a light and a dark value**, recorded here.

  > **Sanctioned literal-colour exceptions**: <e.g. the terminal ANSI palette — the library cannot consume CSS variables>; <e.g. neutral translucent overlays — this system deliberately has no shadow token>. **A new exception gets written in here with its reason**, rather than disabled in place.

- **Both themes are first-class.** <!-- Delete when there is only one theme --> Tokens give theme correctness for free, but **look at it under real light and real dark before reaching a verdict.**

- **<Mobile / narrow viewport> is a different shell, not a shrunken desktop.** <!-- Delete for desktop --> The UI switches shell at <breakpoint>: <side navigation → bottom tabs; tables → cards; actions → a sticky bottom bar>. **A feature that cannot be used at a narrow viewport is not finished.**

- **No inline styles for anything CSS can express.** Compose class names with <cn()>, build variants with <CVA>. Inline styles are for genuinely dynamic values only.

- **hover/focus are CSS, not state** — pseudo-classes (`hover:…`, `focus-visible:ring-…`), never React state for styling.

- **Reuse first, then build new.** Default to <the component directory>; icons only from <the icon library>. Beyond base components, search existing pages for a **composite block** that already does this. **When the same block appears twice, extract it** rather than copy-pasting.

- **Restrained motion.** <150–250ms>, `ease-out`; reuse the existing animation utilities rather than writing `@keyframes` in place; `transition-colors` over `transition-all`. **Every animation carries a `motion-reduce:` treatment.**

- **No silent operations.** Every async flow presents **loading / empty / error / success** (plus progress for a long task).

- **Explanation attaches to the thing it explains.** Definitions, background, why a default is what it is: these hang off their control via <the tooltip / popover component>, not as prose above the content. **Only what the user needs in order to act stays inline** (format, unit, constraint, consequence). See [explanation surfaces](#explanation-surfaces-inline-tooltip-popover).

- **All visible text goes through i18n.** <!-- Delete when there is no i18n --> New text uses `<the t function>` and updates <the locale files> at the same time; lint catches hardcoded <source language>. Do **not** translate dynamic content (user input, terminal output, logs).

- **Do not add a colour or a font ad hoc.** A new colour → a token with both values, recorded here. A new font → a `--font-*` token; **never reference a font family that is not configured**, which falls back silently and misleads.

## Design principles (the why behind the constraints)

1. **<Principle one: e.g. "trust first, clear hierarchy">** — <the most important information gets the visual weight; order a decision page as identity → permissions → detail>.
2. **System state is always visible** — every async flow presents progress → process → result.
3. **Colour is semantic, not decorative** — <blue = interactive; green = success; amber = caution; red = danger>.
4. **<Principle four>** — <expand>.
5. **A consistent shell** — the main pages share one skeleton: <sticky top bar + one scroll container + sticky bottom action bar>. Change the content, not the frame.
6. **The interface is the explanation.** Something needing a paragraph to be usable is a design problem, not a copy problem — fix the labels, the ordering and the defaults first.
7. **High cohesion, low coupling** — one purpose per UI unit. **A file growing is usually the signal to split it.**

## The theming mechanism

**The mechanism:** <e.g. a .dark class on documentElement; every token defined once under :root and once under .dark, so switching the class re-skins everything without components changing any colour>.

**Provider / entry point:** <file path>

**Flash prevention:** <file path> reads <the storage key> and sets the theme class **before** the framework mounts. **New page entry points reuse the existing mounting pattern** rather than writing their own theme logic.

```<language>
// ✅ tokens — adapt to light and dark automatically
<container className="bg-card text-foreground border-border">…</container>

// ✅ the dark: variant is only for dark-specific fine-tuning
<container className="bg-input/30 dark:bg-input/50">…</container>

// ❌ hardcoded — breaks in dark, violates Constraint 1
<container className="bg-white text-[#1a1a1a]">…</container>
```

## Colour tokens (full light and dark values)

**The single source:** <the token definition file>. **Usage:** `bg-<token>`, `text-<token>`, `border-<token>`, focus ring `ring-ring`; opacity modifiers compose (`bg-primary/90`).

### Base surfaces and text

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `background` | `<#>` | `<#>` | Page background |
| `foreground` | `<#>` | `<#>` | Primary text |
| `card` | `<#>` | `<#>` | Cards / surfaces |
| `muted-foreground` | `<#>` | `<#>` | Secondary text (**must meet AA contrast**) |
| `border` | `<#>` | `<#>` | Global borders |
| `ring` | `<#>` | `<#>` | Focus rings |

### Brand primary

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `primary` | `<#>` | `<#>` | Brand text, icons, borders, active emphasis |
| `primary-foreground` | `<#>` | `<#>` | Text/icons on a primary fill |

### Status colours

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `destructive` | `<#>` | `<#>` | Danger / delete / error |
| `success` | `<#>` | `<#>` | Success / enabled / running (solid) |
| `warning` | `<#>` | `<#>` | Caution / sensitive (solid) |

> Solid status colours are for icons and dots; **badges use paired "light background + dark text" tokens** (`*-bg` / `*-fg`).

<!-- Add a section for a categorical/identity colour system, stating that the hash is
     implemented in exactly one place and where -->

## Typography and radii

<Font strategy and the reason — e.g. system fonts only, zero webfonts: it must work offline and must not call a CDN.>

| Token | Value | Purpose |
| --- | --- | --- |
| `font-sans` | `<font stack>` | Body / UI text |
| `font-mono` | `<font stack>` | Code, versions, numeric values |

<!-- Keep for a CJK source language -->
> Both stacks end with an **explicit CJK fallback**, because coverage has to be controlled rather than left to whatever `system-ui` resolves to elsewhere.

**Radii** from `<the --radius base value>`:

| Class | Value | Typical use |
| --- | --- | --- |
| `rounded-sm` | `<>` | Small tags, compact controls |
| `rounded-md` | `<>` | Buttons, inputs |
| `rounded-lg` | `<>` | Cards, panels |
| `rounded-xl` | `<>` | Large cards, dialogs |

**Spacing and width rhythm:** <content width steps>; <sticky bar heights>; <section spacing and card padding>.

## Elevation and stacking

**A shadow says how high a surface floats. Pick from this ladder:**

| Level | Class | Purpose |
| --- | --- | --- |
| **At rest** | none / `shadow-sm` | Flat cards and rows. **Prefer a border over a shadow at rest.** |
| **Raised** | `shadow-md` | Layers anchored to a trigger — dropdowns, popovers |
| **Overlay** | `shadow-lg` | Detached layers owning the screen — dialogs, drawers |

**Do not go beyond `shadow-lg`** — when stronger separation is needed, what you want is a scrim. **Shadows are nearly invisible in dark**, where depth comes from surface colour steps and borders.

**The z-index ladder:** <e.g. z-10 page chrome / z-50 overlays>. **No magic `z-[999]`.**

## Motion

- <150–250ms>, `ease-out`; reuse <existing animation utilities> rather than keyframes in place.
- `transition-colors` / `transition-transform` over `transition-all`.
- **Every animation carries `motion-reduce:`** (or `motion-safe:`).
- Motion serves **understanding a state change**, not decoration. When in doubt, remove it.

## State patterns

**Every async flow covers four states**; missing one means it is not finished:

| State | How it is presented |
| --- | --- |
| Loading | <skeleton / top progress bar / button loading state> |
| Empty | <the empty-state component + one line of "what to do next"> |
| Error | <a specific message + an actionable next step, not "something went wrong"> |
| Success | <toast / in-place state change> |

<!-- Keep where there is a notification wrapper convention -->
> **Success messages always go through `<the wrapper function>`**, not `<the underlying toast>`. The reason: <e.g. a bottom toast covers the output view>. *Enforced by lint (<lint config>); the only exemption is the wrapper itself.*

## Explanation surfaces: inline, tooltip, popover

**The page shows the thing; the explanation hangs off it.** Pick by what the reader needs:

| What the copy is | Where it goes | Component |
| --- | --- | --- |
| **Needed in order to act** — format, unit, range, what the action does | **Inline**, under the control, always visible | `<the field description slot>` |
| What a term, column, badge or value means; a one-line "why this default" | **Tooltip**, on hover *and* focus, ≤ one short sentence | `<Tooltip>` |
| Several lines, a list, a link, anything interactive | **Popover**, on an explicit `<?>` trigger, dismissible | `<Popover>` / `<HoverCard>` |
| Applies to the whole page or flow | Linked out to the docs **once** | `<the docs link pattern>` |
| What just went wrong and what to do | The error state, next to the thing that failed | See [state patterns](#state-patterns) |
| Nothing to show yet | The empty state's "what to do next" — **there the copy *is* the content** | `<the empty-state component>` |

- **Nothing a user must have in order to act may live only behind hover.** Hover does not exist on touch and is invisible to anyone scanning. If the task fails without that sentence, it is inline text.
- **A tooltip trigger is a real control**: keyboard focusable, opening on focus as well as hover, closing on `Esc`, wired with `aria-describedby` (`aria-label` when icon-only). **The `title` attribute is not a tooltip** — unstyleable, delayed, skipped by some screen readers.
- **Touch has no hover**: <the behaviour on this stack — e.g. opens on tap, closes on the next outside tap; below <breakpoint> degrades to `<Popover>`>.
- **No tooltip on a `disabled` control** — it fires no pointer events, so the tip never opens. Wrap it in an enabled element, or put the reason beside it.
- **One explanation, one home.** The same sentence in a tooltip *and* the paragraph above it means both will drift.
- **Do not explain what the interface already says** — "Save — saves the form" trains people to ignore every other tooltip.
- **Explanation is content: it goes through i18n and gets room to stretch.** <!-- Delete when there is no i18n -->

> **Existing conventions in this project:** <where the tooltip pattern is already used and for what; the component's path>.

## Accessibility

- **AA contrast** under both themes; **meaning never carried by colour alone** (pair it with an icon, text or shape).
- Custom controls **keyboard reachable**, with a visible focus ring; icon buttons carry an `aria-label`.
- <Minimum touch target size>. Respect "reduce motion".

## The new page / new section recipe

- [ ] **The entry point** reuses the existing mounting pattern, with no bespoke theme logic
- [ ] **The shell** uses the shared skeleton: <sticky top bar + one scroll container + sticky bottom action bar>
- [ ] **Responsiveness**: switch shell at <breakpoint> rather than shrinking <!-- Delete for desktop -->
- [ ] **Colours** all from tokens, and **both themes actually looked at**
- [ ] **Components** reuse first: existing composite block → base components → extract on the second repetition
- [ ] **Hierarchy** puts the most important information first
- [ ] **Explanation** hangs off its control, with **nothing needed to act behind hover only**
- [ ] **States**: loading / empty / error / success all covered
- [ ] **Motion** restrained, hover/focus via pseudo-classes, with `motion-reduce:`
- [ ] **Elevation** from the ladder, **stacking** from the z-index steps, no magic values
- [ ] **Accessibility**: AA contrast, not colour alone, keyboard reachable, icon buttons labelled
- [ ] **Text** through i18n, **with room to stretch for longer languages** <!-- Delete when there is no i18n -->

```<language>
<a minimal, directly copyable page skeleton — tokens + existing base components + the shared shell>
```

## Sources and verification

- Colour / motion tokens → <file path>
- Theming → <file path>
- Base components → <directory path>
- <The class-merging utility / breakpoint hook> → <file path>

**Related:** enforced rules and the commit flow → [`develop.md`](./develop.md); internal implementation → [`architecture.md`](./architecture.md); documentation maintenance → [`documentation.md`](./documentation.md).

> When editing this document, follow [`documentation.md`](./documentation.md): **token values, component names and variant names must match the code on the current branch** — if `git grep` cannot find it, do not write it in — and counts and lists get enumerated on the spot rather than from memory.

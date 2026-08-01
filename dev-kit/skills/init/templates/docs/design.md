<!-- Generate only for UI. Translate to the project's stack, replace placeholders from real code, delete unused sections and this comment. -->

# <project> design system

Source: `<token/component/theme entry points>`. Enforcement belongs to [`develop.md`](develop.md); implementation layering belongs to [`architecture.md`](architecture.md).

## Core constraints

<!-- Keep only project-supported constraints. -->

- Use semantic tokens from `<token file>`, never literal/palette colours. New concepts receive light/dark values and an entry below. Exceptions: `<enumerated reasoned list>`.
- Verify every UI state in `<supported themes/viewports>`.
- Reuse `<composite/base component directories>` and `<icon library>` before adding components.
- Use `<class/variant utilities>`; dynamic inline styles only where CSS cannot express the value.
- Cover loading, empty, error and success for each owned async flow.
- Use `<motion duration/easing/utilities>` with reduced-motion handling.
- Put action-critical explanation inline; definitions use the project's accessible tooltip/popover pattern.
- Route visible static copy through `<i18n entry point>`; never translate user/runtime/log content. <!-- delete without i18n -->

## Theme and tokens

Theme mechanism/provider/flash prevention: `<real paths and behaviour>`.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `<token>` | `<value>` | `<value>` | `<semantic use>` |

Typography/radius/spacing sources: `<files and actual values>`.

## Layout, elevation and motion

- Shared shell: `<real page/frame composition>`.
- Responsive transition: `<breakpoint and changed shell>`.
- Elevation: `<project ladder>`; z-index: `<project ladder>`.
- Motion: `<allowed duration/easing/utilities and reduce-motion form>`.

## Components and states

| Need | Project component/pattern |
|---|---|
| Loading | `<component>` |
| Empty | `<component and next-action rule>` |
| Error | `<component and actionable-message rule>` |
| Success | `<wrapper/in-place pattern>` |
| Tooltip/popover | `<accessible project wrappers and touch behaviour>` |

Explanation needed to act must not live behind hover. Triggers are keyboard/focus accessible; icon controls have labels; disabled controls expose their reason through an enabled wrapper or adjacent text.

## Accessibility

- `<contrast target>` in every theme; never encode meaning only by colour.
- Keyboard reachability, visible focus, labelled icon controls and `<touch target>`.
- Respect reduced motion and longer localized copy.

## Add a page/section

1. Reuse `<entry/mount/theme shell>`.
2. Compose existing composite/base components and tokens.
3. Implement applicable async states, responsive shell and explanations.
4. Verify themes, viewport, keyboard/focus, labels and reduced motion.
5. Run `<lint/test/runtime verification commands>`.

```<language>
<minimal page skeleton lifted from a real well-built page>
```

## Sources

- Tokens/themes: `<paths>`
- Components/utilities: `<paths>`
- Enforcement: [`develop.md`](develop.md)
- Fact-checking: [`documentation.md`](documentation.md)

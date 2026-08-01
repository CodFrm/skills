<!-- Generate only for real layering. Replace placeholders; delete unused sections and this comment. -->

# Architecture

> Quick map: [`../AGENTS.md`](../AGENTS.md#architecture).

## Layering and dependency direction

```text
<layers/processes and arrows>
```

| Constraint | Concrete repository form | Enforcement |
|---|---|---|
| `<rule>` | `<forbidden/required import, getter or registration path>` | `<check or review-only>` |

Existing-debt exemptions are enumerated and only shrink.

## Subsystems

### `<subsystem>`

<responsibility, boundary, entry point and local traps>. Split details over ~80 lines into `docs/references/architecture-<name>.md`.

## Extension recipes

### Add a `<type>`

1. Implement `<interface>` under `<directory>`.
2. Register through `<registry function>`; do not edit `<shared switch/dispatcher>`.
3. Update `<migration/UI/serialization registration>`.
4. Run `<targeted command>` and `<full command>`.

## Data and migrations

<!-- Keep only with persistence. -->

- Append migrations to `<location>`; never edit applied history.
- Data/config lives at `<path>` and is overridden by `<environment mechanism>`.
- `<project-specific compatibility/rollback constraint>`.

## Generated output

| Path | Source | Regenerate |
|---|---|---|
| `<path>` | `<source/tool>` | `<command>` |

## Related

[`develop.md`](develop.md) · [`testing.md`](testing.md) · [`../AGENTS.md`](../AGENTS.md)

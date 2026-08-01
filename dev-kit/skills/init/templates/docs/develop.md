<!-- Replace placeholders with commands/facts verified on this branch. Delete unused sections and this comment. -->

# Development standards

## Commands

```bash
<install>
<develop/run>
<build>
<targeted test>
<full test>
<lint>
<typecheck>
<format>
<generate, if any>
```

Package manager/entry point: `<name and enforcement>`. Docs, pre-commit and CI use these same commands.

## Structure and style

```text
<working directory tree with one responsibility per path>
```

- Path aliases: `<alias → target/config>`.
- Formatting/naming/import rules: `<real project conventions and command>`.
- Test location/naming: `<real convention>`.

## Enforced rules

| Rule | Correct form | Gate and exemption |
|---|---|---|
| `<decidable rule>` | `<approved wrapper/token/interface>` | `<rule/config/job>; exemption: <path/mechanism>` |

Guard tests at `<path>` load the real configuration and assert violating, compliant and exempt forms.

## Persistent data changes

<!-- Keep only when existing data may be rewritten/reinterpreted. -->

Before changing persistent data, obtain authorization for the exact scope and irreversible effects. State blast radius, rollback/export plan and compatibility window. Separate structure from backfill. Append migrations; do not edit history. Verify forward/backward against representative existing data with the same before/after query, and obtain `<required review>`.

## Commits and PRs

Commit format: `<format>`. Pre-commit runs `<checks>` against staged index content; escape hatch: `<mechanism and required justification>`.

PR evidence:

- what/why;
- commands, exit codes and observations;
- user-visible runtime evidence;
- persistent-data blast radius/rollback when applicable.

## CI gate

<!-- Keep exactly one. -->

- Merge requires `<job>` in `<config>`, running `<same local commands>`.
- This repository has no merge-blocking CI; `<lint/test>` and pre-commit are local-only and skippable.

## Related

[`../AGENTS.md`](../AGENTS.md) · [`architecture.md`](architecture.md) · [`testing.md`](testing.md) · [`verification.md`](verification.md)

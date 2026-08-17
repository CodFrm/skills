# Guardrail harness

Use for user-selected conventions a program can judge with low false-positive risk. Prefer proven recurring violations, single-entry-point rules, dependency direction, and silent failures; leave subjective principles `review-only`.

[TypeScript recipes](lint-recipes-ts.md) and [Go recipes](lint-recipes-go.md) provide copyable implementations; this file owns selection and delivery.

## Escalation ladder

Choose the first sufficient level:

1. enable/scope an existing rule;
2. declarative import/API/global ban;
3. AST/pattern selector;
4. custom lint rule;
5. repository-scanning test;
6. CI script.

Prefer ecosystem dependency tools. Ban the narrow shared entry point rather than downstream symptoms.

## Delivery contract

Every guardrail requires all of:

1. **Real gate:** attach to the repository's existing lint/test command and merge-blocking CI. Without CI, document that it is local/pre-commit only; do not claim merge enforcement.
2. **Scope/exemption:** apply only where the convention holds; exempt the sanctioned wrapper through configuration. Enumerate legacy debt in an exemption baseline that only shrinks.
3. **Corrective diagnostic:** name the permitted form, reason and owning document/issue.
4. **Guard test through real configuration:** prove violations fail and compliant/exempt paths pass. Ensure the existing test command runs it.
5. **Live wiring proof:** temporarily disable the rule, observe the guard test red, restore it, then require the whole tree green.

After all five pass, document the check name, configuration, activation date, exemption, and actual gate.

## Existing violations

Run the candidate rule before landing it:

| Count | Transition |
|---|---|
| 0–20 | fix all, then enable |
| tens/hundreds | freeze an enumerated baseline that only shrinks |
| thousands | reject/narrow the rule or first establish the sanctioned convention |

Do not land a permanently red gate.

## CI

Add checks to the existing merge job using the local package/Make commands. If no CI exists, recommend minimal CI; if no remote exists, keep local/pre-commit enforcement and report the limitation.

## Pre-commit

Pre-commit is early feedback, not a merge gate. It must:

- inspect only staged relevant files;
- trigger by file type, including deletions where consistency checks require it;
- expose a documented narrow escape hatch rather than forcing `--no-verify`.

### Check the snapshot in the Git index, not the working tree

Inspect the staged index snapshot rather than mutable working files.

```sh
git diff --cached --name-only -z --diff-filter=ACMRD -- '<patterns>'
snapshot=$(mktemp -d)
git checkout-index --all --prefix="$snapshot/"
<check command> --root="$snapshot"
```

Clean the exact temporary directory after the check.

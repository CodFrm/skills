<!-- Generate when the contributor-doc set needs an ownership/fact-check policy. Replace placeholders and delete this comment. -->

# Documentation maintenance

Discover tracked docs with `git ls-files '*.md'`. Use git-aware commands for facts; untracked working files are not evidence of committed project state.

## Ownership

| File | Owns |
|---|---|
| `AGENTS.md` | project facts, routing, selected principles, quick map |
| `develop.md` | commands, structure, style, enforced rules, delivery |
| `testing.md` | test design and commands |
| `verification.md` | real-runtime scratch workflow |
| `design.md` | design system |
| `observability.md` | logs/metrics/traces |
| `architecture.md` | layering/subsystems/extension recipes |
| `documentation.md` | this policy |
| `README.md` | index |

Move a fact to its owner and link; do not copy it.

## `docs/specs/` is a record, not part of this set

Do not fact-sync completed historical specs to current code. During an active round, change a formal spec only when the requirement changed, obtain approval again and commit that revision; never edit it to match implementation. A superseding requirement creates a new spec and marks the old status.

Specs stay outside the index/ownership table. Their links must resolve and they must contain no credential or personal data.

## Fact and policy audit

For every changed claim verify:

| Claim | Evidence |
|---|---|
| file/path | `git ls-files <path>` |
| identifier/signature | `git grep` plus direct file read |
| count/list | enumerate authoritative source now |
| lint scope | configuration including overrides/ignores |
| command | manifest/Make target plus a real run |

For every policy touched, identify owner, trigger, action, exception/fallback, compliance evidence and stop condition. Search absolute wording as a review queue:

```bash
git grep -n -Ei 'always|never|must|all ' -- AGENTS.md 'docs/*.md' 'docs/**/*.md'
```

## Structural audit

- Update the index, ownership table and AGENTS routes when docs are added/renamed/deleted.
- Resolve every relative link and changed anchor.
- Label branch-only planned facts; do not present them as current trunk state.
- After rebase/conflict resolution, repeat checks on the resolved final tree.

```bash
git ls-files '*.md' | while IFS= read -r doc; do
  sed '/^```/,/^```/d; /^~~~/,/^~~~/d' "$doc" | sed -E 's/`[^`]*`//g' \
    | grep -oE '\]\(([^)]+)\)' | sed -E 's/^\]\(|\)$//g' \
    | grep -vE '^(https?:|mailto:|#)' | while IFS= read -r link; do
      target="$(dirname "$doc")/${link%%#*}"
      [ -e "$target" ] || echo "broken $doc -> $link"
  done
done
```

## Deletion

Search the removed bare identifier across tracked files and clear links/index rows, enumerations, examples, comments, config/CI/scaffolding and now-unused helpers:

```bash
git grep -inw '<removed identifier>' -- . ':!<allowed history paths>'
```

Then rerun link, anchor, policy and project verification checks. Report only the scope actually verified.

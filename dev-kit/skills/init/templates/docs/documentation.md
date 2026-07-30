<!--
Template: docs/documentation.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, and delete
this comment block at the end.
Owns "how the documentation itself is maintained": organisation rules, fact-checking discipline,
cross-document policy consistency. Only worth having once more than 3 docs exist.
-->

# Documentation maintenance and fact-checking

> **Read this before adding, editing, reorganising or reviewing any tracked agent / contributor Markdown** — `AGENTS.md`, `docs/*`, `.github/*.md`, and the `README.md` files next to the source. **Do not work from a fixed list**; discover the current set with `git ls-files '*.md'`.

Three responsibilities: keeping the set **organised** (links resolve, the index is current, nothing duplicated), keeping every claim **true on the current branch**, and keeping **policy consistent across documents**.

## Why it is needed

- **Stale facts** — a class renamed, a count changed, a file moved, the documentation still carrying the old value.
- **Branch leakage** — something that exists only on a feature branch written up as though it were on the trunk.
- **Policy conflict** — two documents giving different conditions for the same rule. An agent that reads only one follows a rule the other has narrowed.
- **Stale after conflict resolution** — the fact check ran against the old `HEAD`, so it looks checked but was never checked against the tree that will merge.

**Rule of thumb: if `git grep` cannot find it on this branch, do not claim it.**

Verify with **git-aware** commands (`git grep`, `git ls-files`, `git ls-tree`), **never** plain `rg` / `ls` — the latter match **uncommitted** files, which is the exact cause of branch leakage.

## Three snapshots: the baseline tree, the working diff, the final tree

- **The baseline tree** — the committed state you started from (`git rev-parse HEAD`).
- **The working diff** — your uncommitted changes on top of it, code and documentation alike.
- **The final tree** — what will exist once the change lands, **including after any rebase or conflict resolution**.

When code and documentation change in the same PR, checking only the old `HEAD` misses what the working diff introduces. **After a rebase or conflict resolution, re-run the check against the resolved final tree** — resolving a conflict can quietly bring a stale fact back.

## The policy consistency check

For every rule you touch or find, pin down seven things: the **owner** (which document holds the authoritative version), the **trigger**, the **action**, the **exception**, the **fallback** when the exemption applies, the **evidence** for compliance, and the **stop condition**.

Search for absolute wording, which often hides an unwritten exception:

```bash
git grep -n -Ei 'always|never|must|all ' -- AGENTS.md 'docs/*.md' 'docs/**/*.md'
```

**Each hit is a review-queue entry, not an automatic rewrite** — some absolutes are deliberate non-negotiables. When changing an upstream rule, confirm the downstream documents' narrowings of it still hold.

**For a lint rule or typecheck setting, record the set of files / ignores / overrides that produces the final effect**, not just the rule name: a rule can be `error` globally and `off` for a glob. **Verify against the configuration file; do not infer scope from the name.**

## The documentation set and its ownership (do not duplicate — cross-link)

| Document | What it owns |
| --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | Project facts + the must-read routing table + engineering principles + a quick architecture map. `CLAUDE.md` only `@import`s it |
| [`develop.md`](./develop.md) | The concrete "how": commands, structure, style, the commit flow |
| [`testing.md`](./testing.md) | How tests are designed, what to write, what not to, how to clean up, how to run them |
| [`verification.md`](./verification.md) | One-off end-to-end verification: the scratch script + the report |
| [`design.md`](./design.md) | The design system: tokens, components, theming, motion, states, explanation, the new-page recipe |
| [`observability.md`](./observability.md) | Log levels and where to instrument, metrics, traces, investigating with them |
| [`architecture.md`](./architecture.md) | Layering, dependency direction, subsystems, extension recipes |
| [`documentation.md`](./documentation.md) | This file |
| [`README.md`](./README.md) | The index pointing at all of the above |
| <a README next to the source> | That module's purpose, boundary, entry point and local traps — **not** a copy of repository-level architecture |

**Move a fact to the document that owns it and cross-link — never copy the same fact into two places.** Discover the current set with `git ls-files '*.md'` rather than trusting this table.

<!-- Keep when the project writes specs under docs/specs/ -->
### `docs/specs/` is a record, not part of this set

`docs/specs/*.md` records **what was agreed on the day it was written**, and is deliberately outside everything above:

- **The fact check does not apply to it.** A class named in a six-month-old spec that has since been renamed is **history**, not drift — "correct" it and you have rewritten the record of what was decided. When a requirement is superseded, mark the spec's `Status` and write a new one.
- **It is not added to the index or the ownership table.** Specs are append-only; the directory listing is their index.

What **does** apply: links inside a spec must resolve, and no spec may contain credentials or personal data. A spec is also the basis a change gets reviewed against.

## Checklist 1 — organisation (every documentation change)

- [ ] Added / renamed / deleted a document → update the [`README.md`](./README.md) index, the ownership table above, **and** every reference in `AGENTS.md`
- [ ] Deleted anything → sweep with `git grep -inw` on the **bare word** per [Deletion](#deletion-delete-until-it-reads-as-though-it-were-never-written), clearing all six kinds of trace
- [ ] Every relative link resolves (the one-shot check below)
- [ ] Nothing that exists only on a feature branch is written up as the trunk's current state — remove it, or label it "planned (branch `X`)"
- [ ] No fact is duplicated across two documents

## Checklist 2 — fact-checking (whenever the documentation states something specific)

Verify **entry by entry** against the code:

| The claim | What verifies it |
| --- | --- |
| A file / entry point exists | `git ls-files <path>` |
| A class / identifier exists **under exactly this name** | `git grep "<Name>" -- <directory>` — **renaming is the number one source of drift** |
| A function / constructor signature | Open the file and check parameter by parameter |
| A count ("N languages", "N tools") | Enumerate the authoritative source; **trust neither the prose nor your memory** |
| A lint rule and its scope | Read the configuration directly, including files / ignores / overrides |
| A command exists | Find it in `package.json` / `Makefile`, **and actually run it once** |

Three traps: **the working tree ≠ what is committed** (plain `rg`/`ls` → branch leakage); **same name, different thing** (<this repository's example>); **counts drift silently**.

## The one-shot check

<!-- Replace with the project's actual checks. Each reads **committed** code. -->

```bash
echo "== entry point files =="
for f in <list of entry point files>; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo "ok   $f" || echo "missing/untracked $f"
done
echo "== <other facts to enumerate> =="; <git ls-tree / git grep command>
```

Link integrity across **every tracked Markdown file**:

```bash
git ls-files '*.md' | while IFS= read -r doc; do
  # Strip fenced code blocks and inline code first, so example links are not misread as broken
  sed '/^```/,/^```/d; /^~~~/,/^~~~/d' "$doc" | sed -E 's/`[^`]*`//g' \
    | grep -oE '\]\(([^)]+)\)' | sed -E 's/^\]\(|\)$//g' \
    | grep -vE '^(https?:|mailto:|#)' | while IFS= read -r link; do
      target="$(dirname "$doc")/${link%%#*}"
      [ -e "$target" ] && echo "ok      $doc → $link" || echo "broken  $doc → $link"
  done
done
```

**A link check is a best-effort signal, not a proof.** It does not resolve reference-style links and does not implement the slug rules for heading anchors, so a clean run only means no missing link **targets**. **Fragment links you changed get checked by hand**, especially with non-ASCII headings and the automatic suffixes on duplicate headings (`#foo-1`).

## Deletion: delete until it reads as though it were never written

**The criterion is not "the main body is gone" but "nothing in the repository shows it ever existed".** A leftover is worse than an absence — a link that 404s, a command that no longer exists, a capability a reviewer still believes in — because it looks credible.

**Six kinds of trace to clear:**

| Trace | Where it hides |
| --- | --- |
| Dangling links and index entries | The [`README.md`](./README.md) index, the ownership table, `AGENTS.md`'s routing table |
| List-style enumerations | The directory tree, one-line "which commands are supported" lists, coverage descriptions |
| Examples and snippets | Paragraphs in other documents using it as an example, example commands and output |
| Code comments | References in comments, `@param` descriptions |
| Config and scaffolding | Config entries, CI steps, gitignore lines, fixtures that exist only for it |
| Helpers left with one user | Utilities, style classes and template sections written for it — now dead code |

**Search the bare word, not the phrase you remember writing:**

```bash
git grep -inw '<the removed word>' -- . ':!<paths allowed to keep it>'
```

Leftovers hide **where you cannot recall writing them** — a slash-separated list in a directory tree, a "covers A, B and C" line, inside the parentheses of a comment. A word-bounded bare-word search is what catches them.

After deleting, re-run the link check **and the policy consistency check**: the rule you deleted may be the premise of an exception somewhere else.

## When you find an inconsistency

**Change the documentation to match the code** — the code on this branch is the source of truth. The exception: where the code itself is wrong, fix the code and say so in the PR. Either way, **never silently let through a check you could not satisfy.**

## Honest completion claims

Say "swept everything", "verified" or "all fixed" only when the scope and the evidence genuinely cover it — that is, when you **really** ran the check against the final tree across every file the claim implies. A more accurate summary is usually narrower: which documents got a fact audit, what the evidence was, and which only got a structural check.

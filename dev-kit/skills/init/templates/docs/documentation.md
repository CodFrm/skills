<!--
Template: docs/documentation.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, and delete
this comment block at the end.
This file owns "how the documentation itself is maintained": organisation rules, fact-checking
discipline, cross-document policy consistency.
It is only worth having once more than 3 docs have been generated.
-->

# Documentation maintenance and fact-checking

> **Read this file before adding, editing, reorganising or reviewing any tracked agent / contributor Markdown** — `AGENTS.md`, `docs/*`, `.github/*.md`, and the `README.md` files scattered next to the source. **Do not work from a fixed list**; discover the current set on the spot with `git ls-files '*.md'`.

This file has three responsibilities: keeping the documentation set **organised** (links resolve, the index is current, nothing is duplicated), keeping every claim **true on the current branch**, and keeping **policy consistent across documents** (no two documents giving conflicting rules for the same situation).

## Why it is needed

Contributor documentation describes a living codebase, so a few failure modes recur:

- **Stale facts** — a class was renamed, a count changed, a file moved, and the documentation still carries the old value.
- **Branch leakage** — something that exists only on a feature branch gets written up as though it were already on the trunk.
- **Policy conflict** — two documents give different conditions for the same rule (one says a test is unconditional, the other defines an exception to it). An agent that reads only one will follow a rule the other has narrowed or overturned.
- **Stale after conflict resolution** — code and documentation change in the same PR, or conflicts get resolved during a rebase, while the fact check only ever ran against the old `HEAD`. It looks checked, but it was never checked against the tree that will actually merge.

**Rule of thumb: if `git grep` cannot find it on this branch, do not claim it.**

Verify with **git-aware** commands (`git grep`, `git ls-files`, `git ls-tree`), and **never** plain `rg` / `ls` — the latter match **uncommitted** files in the working tree, so feature-branch code sitting in your checkout but not yet on the trunk masquerades as released. That is the exact cause of "branch leakage".

## Three snapshots: the baseline tree, the working diff, the final tree

Fact-checking against a single snapshot is not enough:

- **The baseline tree** — the committed state you started from (`git rev-parse HEAD`).
- **The working diff** — your uncommitted changes on top of the baseline (code and documentation alike).
- **The final tree** — what will genuinely exist once your change lands, **including after any rebase or conflict resolution**.

When code and documentation change in the same PR, checking only the old `HEAD` misses the facts the working diff is about to introduce or remove. **After a rebase / merge / conflict resolution, re-run the check against the resolved final tree** rather than reusing the pre-conflict result — resolving a conflict can quietly bring a stale fact back, or lose a documentation update.

## The policy consistency check

Beyond individual facts, check that a rule in one document does not contradict the same rule in another. For every rule you touch, or find while checking, pin down seven things: the **owner** (which document holds the authoritative version), the **trigger** (when it applies), the **action** (what to do), the **exception** (documented exemptions), the **fallback** (what to do when the exemption applies), the **evidence** (how to check compliance), and the **stop condition** (when it no longer applies).

Search for absolute wording — it often hides an unwritten exception or a stale blanket rule:

```bash
git grep -n -Ei 'always|never|must|all ' -- AGENTS.md 'docs/*.md' 'docs/**/*.md'
```

**Each hit is a review-queue entry, not an automatic rewrite.** Confirm the absolute wording is genuinely correct first (some are deliberate non-negotiables) before deciding whether to relax it; when changing an upstream rule, confirm the downstream documents' narrowings of it still hold.

## Depth for lint / configuration descriptions

When describing a lint rule, a typecheck setting or similar configuration-driven behaviour, record **the set of files/ignores/overrides that produces the final effect**, not just the rule name — a rule can be `error` globally and then `off` for a file glob, and writing only the rule name hides that. **Verify against the configuration file directly; do not infer the scope from the rule name.**

## The documentation set and its ownership (do not duplicate — cross-link)

| Document | What it owns |
| --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | Project facts + the must-read routing table + engineering principles + a quick architecture map. The single source of truth; `CLAUDE.md` only `@import`s it. |
| [`develop.md`](./develop.md) | The concrete "how": commands, structure, style, the commit flow. |
| [`testing.md`](./testing.md) | How tests are designed, what to write, what not to, how to clean up, how to run them. |
| [`verification.md`](./verification.md) | One-off end-to-end verification: the scratch script + the report. |
| [`design.md`](./design.md) | The design system: tokens, components, theming, motion, states, where explanation lives, the new-page recipe. |
| [`observability.md`](./observability.md) | Log levels and where to instrument, metrics, traces, and how to investigate and reproduce with them. |
| [`architecture.md`](./architecture.md) | The implementation in depth: layering, dependency direction, subsystems, extension recipes. |
| [`documentation.md`](./documentation.md) | This file: documentation organisation rules, fact-checking discipline, policy consistency. |
| [`README.md`](./README.md) | The index pointing at all of the above. |
| <a README next to the source> | That module's purpose, boundary, entry point and local traps — **not** a copy of repository-level architecture or standards. |

**When moving a fact, move it to the document that owns it and cross-link — never copy the same fact into two places**, or they drift apart sooner or later. To discover the current set rather than trusting this table, run `git ls-files '*.md'`.

<!-- Keep when the project writes specs under docs/specs/ -->
### `docs/specs/` is a record, not part of this set

`docs/specs/*.md` is one file per requirement, recording **what was agreed on the day it was written**. It is deliberately outside everything above, and the difference matters in both directions:

- **The fact check does not apply to it.** A class named in a six-month-old spec that has since been renamed is not drift, it is **history** — "correct" it and you have rewritten the record of what was decided. When a requirement is later superseded, mark the spec's `Status` line and write a new one; do not edit an old spec into agreement with today's code.
- **It is not added to the index or the ownership table above.** Specs are append-only and arrive continuously; the directory listing is their index. A new spec is not a documentation change.

What **does** still apply: links inside a spec must resolve, and no spec may contain credentials or personal data. It is also not exempt from being *read* — a spec is the basis a change gets reviewed against.

## Checklist 1 — organisation (every documentation change)

- [ ] Added / renamed / deleted a document → update the [`README.md`](./README.md) index, the ownership table above, **and** every reference in `AGENTS.md`.
- [ ] Deleted a document / section / command / concept → sweep with `git grep -inw` on the **bare word** per ["Deletion: delete until it reads as though it were never written"](#deletion-delete-until-it-reads-as-though-it-were-never-written), clearing all six kinds of trace.
- [ ] Every relative link resolves (run the one-shot check below).
- [ ] Nothing that exists only on a feature branch is written up as the trunk's current state — either remove it, or label it explicitly as "planned (branch `X`)".
- [ ] No fact is duplicated across two documents; the document that owns it holds it and the rest link to it.

## Checklist 2 — fact-checking (whenever the documentation states something specific)

Verify **entry by entry** against the code:

| The claim in the documentation | What verifies it |
| --- | --- |
| A file / entry point exists | `git ls-files <path>` |
| A class / identifier exists **under exactly this name** | `git grep "<Name>" -- <directory>` — **renaming is the number one source of drift** |
| A function / constructor signature | Open the file and check parameter by parameter |
| A count ("N languages", "N tools") | Enumerate the authoritative source; **trust neither the prose nor your memory** |
| A lint rule and its scope | Read the lint configuration directly (including files / ignores / overrides) |
| A command exists | Find it in `package.json` / `Makefile`, **and actually run it once** |

Three traps worth naming individually:

- **The working tree ≠ what is committed.** Plain `rg`/`ls` match uncommitted files → branch leakage.
- **Same name, different thing.** <Give this repository's example: two things with similar names that are entirely different>.
- **Counts drift silently.** When the documentation carries a number, enumerate it on the spot; trust neither the prose nor your memory.

## The one-shot check

<!-- Replace the checks with the project's actual ones. Each of them reads **committed** code. -->

```bash
echo "== entry point files =="
for f in <list of entry point files>; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo "ok   $f" || echo "missing/untracked $f"
done
echo "== <other facts to enumerate> =="; <git ls-tree / git grep command>
```

Link integrity — confirm every relative Markdown link resolves, across **every tracked Markdown file**:

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

**A link check is a best-effort signal, not a proof of correctness**: the pipeline above skips fences and inline code, but it does not resolve reference-style links and does not fully implement the slug rules for heading anchors. A clean run only means no missing link **targets** were found; it does not mean every anchor and every link's intent was verified. **Fragment links you changed get checked by hand**, especially with non-ASCII headings, punctuation, and the automatic suffixes on duplicate headings (`#foo-1`).

## Deletion: delete until it reads as though it were never written

When deleting a document, a section, a command or a concept, **the criterion is not "the main body is gone" but "nothing in the repository shows it ever existed"**. A leftover is worse than an absence: a reader clicking a link that 404s, an agent running a command that no longer exists, a reviewer believing a capability is still there — all cost more than "never written", because they look credible.

**Six kinds of trace that must be cleared after a deletion** (not just the prose):

| Trace | Where it typically hides |
| --- | --- |
| Dangling links and index entries | The [`README.md`](./README.md) index, the ownership table above, `AGENTS.md`'s must-read routing table |
| List-style enumerations | The directory structure tree, one-line enumerations of "which commands/subsystems are supported", test coverage descriptions |
| Examples and snippets | Paragraphs in other documents using it as an example, example commands, example output |
| Code comments | References to that document/command/field in comments, `@param` descriptions and the like |
| Config and scaffolding | Config entries, CI steps, gitignore lines and test fixtures that exist only for it |
| Helpers left with one user | Utility functions, style classes and template sections written for it — once the main body is gone, they are dead code |

**The mechanical method: search the bare word, not the phrase you remember writing.**

```bash
# Work through each removed identifier / command / concept word, case-insensitive, word-bounded
git grep -inw '<the removed word>' -- . ':!<paths allowed to keep it>'
```

Searching for "the full phrasing I remember writing" almost always misses some — leftovers love to hide **where you cannot recall writing them**: a slash-separated list in a directory tree, a "covers A, B and C" line in a README, inside the parentheses of some comment. **A word-bounded bare-word search** is what catches them all.

After deleting, re-run the link check (see the one-shot check above) and the policy consistency check: the rule you deleted may be the very premise of an exception somewhere else.

## When you find an inconsistency

**Change the documentation to match the code** — the code on this branch is the source of truth. The exception: if the code itself is wrong (a real bug), fix the code and say so in the PR. Either way, **never silently let through a check you could not satisfy** — state it in the PR description so a reviewer can confirm.

## Honest completion claims

Say "swept everything", "verified" or "all fixed" only when the scope and the evidence genuinely cover it — that is, when you **really** ran the check against the final tree, across every file the claim implies. A more accurate summary is usually narrower: which documents got a fact/policy audit, what the evidence was, and which documents only got a structural check or were deliberately left alone.

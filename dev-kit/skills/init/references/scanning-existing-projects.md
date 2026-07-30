# How to scan an existing project

> New projects skip this file — there is nothing to scan, so go straight to `SKILL.md`'s minimal probe.
>
> This file is **the deep scan's toolbox**: a set of commands producing **quantified evidence** to hold up step 2's diagnostic report.
>
> **Everything uses `git grep` / `git ls-files`, never `grep -r` / `rg` / `ls`.** The former search only tracked files — orders of magnitude faster (measured at 0.08s vs 21s) and they do not count your local uncommitted experimental code as the project's current state.

## Why quantify rather than "yes / no"

**"There are hardcoded colours" and "there are 137 hardcoded colours" lead to completely different actions**: the former gets fixed on the spot, the latter has to go through a ratchet baseline. Without numbers the user cannot decide, and you cannot give a responsible recommendation.

Likewise: "there are tests" carries no information, while "there are 240 tests, 30 of which are pure pass-through renders" does.

**Every finding has to trace back to a specific file and line**, so that when the user pushes back you can lay it out on the spot rather than saying "I think".

---

## The scan checklist

Run them in order and record **each item's number + the first few samples**. Pick commands by ecosystem; do not run them all.

### 1. Project shape

```bash
# Ecosystem, package manager, output
ls package.json go.mod Cargo.toml pyproject.toml 2>/dev/null
ls pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null
git ls-files | sed 's|/.*||' | sort | uniq -c | sort -rn | head -15   # top-level directory distribution
git ls-files | wc -l                                                  # order of magnitude

# Command entry points (the docs may only carry what exists here)
[ -f package.json ] && node -e "console.log(Object.keys(require('./package.json').scripts||{}).join('\n'))"
[ -f Makefile ] && grep -E '^[a-z][a-z0-9_:-]*:' Makefile | cut -d: -f1
```

### 2. The existing constraint system (decides initialise vs fill in)

```bash
git ls-files | grep -iE '^(AGENTS|CLAUDE|CONTRIBUTING|README)\.md$|^docs/|^\.github/.*\.md$'
wc -l AGENTS.md CLAUDE.md docs/*.md 2>/dev/null       # length = how much of it is real content
```

**Pay particular attention to whether `CLAUDE.md` is nothing but `@AGENTS.md`** — content in both is the most common structural problem and leads to split rules.

### 3. Whether the docs still hold (the easiest thing to rot on an existing project)

```bash
# Broken links
git ls-files '*.md' | while IFS= read -r doc; do
  sed '/^```/,/^```/d' "$doc" | sed -E 's/`[^`]*`//g' | grep -oE '\]\(([^)]+)\)' \
    | sed -E 's/^\]\(|\)$//g' | grep -vE '^(https?:|mailto:|#)' | while IFS= read -r l; do
      [ -e "$(dirname "$doc")/${l%%#*}" ] || echo "broken link $doc → $l"
  done
done | tee /tmp/init-scan-links.txt | wc -l

# Whether the symbols the docs claim still exist (a spot check, not exhaustive)
git grep -ohE '`[A-Z][A-Za-z0-9_]{3,}`' -- '*.md' | tr -d '`' | sort -u | head -30 \
  | while read -r sym; do
      git grep -q "$sym" -- ':!*.md' || echo "mentioned in the docs but not in the code: $sym"
    done
```

**This item's output directly decides whether to generate `docs/documentation.md`** — a pile of broken links and stale facts means what this project lacks is precisely documentation maintenance discipline.

### 4. How badly "one concept has exactly one implementation" is breached

**This is the main input to guardrail selection.** Every entry needs a number:

```bash
# Hardcoded colours (front end)
git grep -nE '(text|bg|border|ring|fill|stroke)-(red|blue|green|gray|zinc|slate|neutral|amber|orange|purple|violet|pink|rose|teal|cyan|sky|indigo|emerald|lime|yellow|stone|white|black)(-[0-9]{2,3})?' \
  -- '*.tsx' '*.jsx' '*.vue' | wc -l
git grep -nE '#[0-9a-fA-F]{3,8}\b' -- '*.tsx' '*.jsx' '*.css' '*.vue' | wc -l

# Bare logging (where a logger wrapper exists, these are violations)
git grep -n 'console\.log(' -- '*.ts' '*.tsx' '*.js' | wc -l
git grep -nE '\bfmt\.Print|"log"' -- '*.go' | wc -l
git grep -nE '\bprint\(' -- '*.py' | wc -l

# Hardcoded user-visible strings (adjust the character range to the project's source language;
# the example below is a Chinese-source project).
# Use an explicit character range rather than \p{Han}: under ERE, [\p{Han}] is treated as a
# literal character set (measured at 304 false positives on a real repository), and `git grep -P`
# has no PCRE/UCP support in many git builds and silently returns 0 — which is worse than a
# false positive, because it tells you "no hardcoded strings, all good".
git grep -nE '>[^<>{]*[一-龥]' -- '*.tsx' '*.jsx' | wc -l
git grep -nE '>[^<>{]*[一-龥]' -- '*.tsx' '*.jsx' | grep -vE '__tests__|\.test\.|//' | head -5

# Calling the underlying library directly instead of the project wrapper — find the wrapper first, then count what bypasses it
git grep -lniE 'logger|notify|toast|formatDate' -- '*/lib/*' '*/pkg/*' '*/utils/*' | head
```

> **These are heuristic scans and they over-report.** The hardcoded-strings one drags in comments and test files (the second command above does a rough filter). **A human looks at the numbers before they go in the report** — reporting an inflated number makes the user decide against the wrong scale.

**`git grep ... | wc -l` counts matching lines, not occurrences** — two palette class names on one line counts as 1. That is enough for a scale judgement, but **the report says "N lines" or "N files", not "N occurrences"**, or the user decides against a number that is too small. For an exact count use `git grep -o ... | wc -l` (needs a reasonably recent git).

For each entry, **record the line count, the number of files involved and the first 3 samples** (file:line) together. The scale decides the landing strategy:

| Count | Landing strategy |
|---|---|
| 0 | The convention is already being held — adding the guardrail is **zero-cost lock-in**, so do it first |
| 1–20 | Fix them all in the same change, then add the guardrail |
| 20–200 | Ratchet: freeze into an exemption baseline that only shrinks |
| 200+ | At this scale, decide first whether the convention is even real: sample 5 violations and check whether the "correct" form appears anywhere at all. **Never used → the project probably never intended to follow it, so report that finding and recommend dropping it.** In use but losing → the ratchet baseline is the recommendation. Either way it reaches the user as one row of step 2's recommendation list, carrying the number and the cost, not as a separate question |

### 5. Recurring problems (the highest-value guardrail candidates)

```bash
# The same class of fix recurring = a convention that was never mechanised
git log --oneline --grep='fix' -i -200 | sed -E 's/^[0-9a-f]+ //' \
  | sed -E 's/[0-9]+//g' | sort | uniq -c | sort -rn | head -20

# The same file being fixed repeatedly = that place may lack a constraint
git log --format= --name-only -300 | grep -v '^$' | sort | uniq -c | sort -rn | head -15

# revert / hotfix frequency
git log --oneline -300 | grep -icE 'revert|hotfix'
```

**What this item digs up outranks every generic recommendation** — it is the specific problem this project has been proven unable to hold back.

### 6. Tests as they stand

```bash
git ls-files | grep -cE '\.(test|spec)\.[jt]sx?$|_test\.go$|test_.*\.py$'   # test file count
git ls-files | grep -E '\.(test|spec)\.|_test\.go$' | head -10               # location and naming convention

# Signals of low-value tests (leads to check, not verdicts)
git grep -lnE 'toEqual\(\[?[A-Z_]+\]?\)' -- '*.test.*' | wc -l      # suspected tautology
git grep -lnE 'expect\(mock[A-Za-z]*\)\.toHaveBeenCalled\(\)$' -- '*.test.*' | wc -l
```

### 7. e2e and verification as they stand

```bash
ls -d e2e tests/e2e cypress playwright 2>/dev/null
git ls-files | grep -E '^e2e/' | head -20
grep -n 'testIgnore\|testDir' playwright*.config.* 2>/dev/null   # is there a mechanical twin-track guarantee
grep -n 'e2e/scratch\|^\.env$' .gitignore 2>/dev/null            # does the scratch track exist
```

**The key judgement: is there only one track.** With only one, verification scripts get stuffed into the smoke suite and it quickly becomes slow and brittle — a high-value finding.

### 8. Gates as they stand

```bash
ls -d .github/workflows .gitlab-ci.yml .circleci 2>/dev/null
grep -rhE '^\s+- (run|uses):' .github/workflows/*.y*ml 2>/dev/null | head -20   # what CI actually runs
ls .husky 2>/dev/null && cat .husky/pre-commit 2>/dev/null | head -20
```

Judge three things: **does CI exist**, **does it run the same commands as local**, and **does it genuinely block merges** (or is it only informational).

### 9. Observability as it stands

```bash
# Is there a logger wrapper (wrapper → the docs write the wrapper; no wrapper → ask whether to introduce one)
git grep -lE 'zap\.|logrus|slog\.|winston|pino|getLogger' -- '*.go' '*.ts' '*.py' | head
git ls-files | grep -iE '(logger|logging)\.(go|ts|py)$|pkg/logger|lib/logger'

# The shape of the existing logs (decides how the doc examples are written)
git grep -nE '(logger|log)\.(Info|Warn|Error|info|warn|error)\(' | head -20

# Metrics / traces
git grep -lE 'prometheus|opentelemetry|otel' | head
```

---

## Once the scan is done

Turn each item into **one row** of `SKILL.md` step 2's recommendation list: **what to do → the evidence behind it, with its number → cost**. The finding and the recommendation it justifies live in the same row — the report has no separate findings section, so **an item that justifies no row (not even a "not recommended" one) does not reach the report at all.**

**Do not dump raw command output at the user.** Several hundred lines of grep results is not a report — the numbers, the conclusions and the costs are. **Keep the `file:line` samples as a reserve** for when the user pushes back, and print them only where the number does not make the case on its own.

**The scan produces no changes.** This step writes not one character into the project: read only.

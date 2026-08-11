# Scan an existing project

Run each item read-only. Return a count, first three `file:line` samples and one conclusion. Use `git grep`/`git ls-files` for tracked content; choose ecosystem-relevant commands only.

## 1. Project shape and commands

```bash
git ls-files | wc -l
git ls-files | sed 's|/.*||' | sort | uniq -c | sort -rn | head -15
ls package.json go.mod Cargo.toml pyproject.toml pom.xml 2>/dev/null
ls pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null
[ -f package.json ] && node -e "console.log(Object.keys(require('./package.json').scripts||{}).join('\n'))"
[ -f Makefile ] && grep -E '^[a-z][a-z0-9_:-]*:' Makefile | cut -d: -f1
```

## 2. Existing constraints and doc drift

```bash
git ls-files | grep -iE '^(AGENTS|CLAUDE|CONTRIBUTING|README)\.md$|^docs/|^\.github/.*\.md$'
wc -l AGENTS.md CLAUDE.md docs/*.md 2>/dev/null
```

Check whether CLAUDE.md duplicates AGENTS.md. Run the repository link/anchor checker and sample documented identifiers against non-Markdown tracked code. Count broken links and stale symbols.

## 3. Repeated implementations

Count matching lines and files, then inspect samples before reporting scale:

```bash
git grep -nE '#[0-9a-fA-F]{3,8}\b' -- '*.tsx' '*.jsx' '*.css' '*.vue'
git grep -n 'console\.log(' -- '*.ts' '*.tsx' '*.js'
git grep -nE '\bfmt\.Print|"log"' -- '*.go'
git grep -nE '\bprint\(' -- '*.py'
git grep -lniE 'logger|notify|toast|formatDate' -- '*/lib/*' '*/pkg/*' '*/utils/*'
```

Describe `wc -l` results as matching lines, not occurrences. Landing strategy: 0 = zero-cost lock-in; 1–20 = fix then gate; 20–200 = ratchet; 200+ = first verify that a real sanctioned convention exists.

## 4. Recurring failures

```bash
git log --oneline --grep='fix' -i -200
git log --format= --name-only -300 | grep -v '^$' | sort | uniq -c | sort -rn | head -15
git log --oneline -300 | grep -icE 'revert|hotfix'
```

Group repeated fix classes and repeatedly repaired files. These outrank generic recommendations.

## 5. Tests

```bash
git ls-files | grep -cE '\.(test|spec)\.[jt]sx?$|_test\.go$|test_.*\.py$'
git ls-files | grep -E '\.(test|spec)\.|_test\.go$' | head -10
git grep -lnE 'expect\(mock[A-Za-z]*\)\.toHaveBeenCalled\(\)$' -- '*.test.*'
```

Treat suspicious patterns as sampling leads, not verdicts. Record runner, naming/location, low-value signals and shared mocks.

## 6. E2E and verification

```bash
ls -d e2e tests/e2e cypress playwright 2>/dev/null
git ls-files | grep -E '^e2e/' | head -20
grep -n 'testIgnore\|testDir' playwright*.config.* 2>/dev/null
grep -n 'e2e/scratch\|^\.env$' .gitignore 2>/dev/null
```

Record runtime form, whether smoke/scratch are mechanically separated, and whether real-runtime evidence has a report path.

## 7. Gates

```bash
ls -d .github/workflows .gitlab-ci.yml .circleci 2>/dev/null
grep -rhE '^\s+- (run|uses):' .github/workflows/*.y*ml 2>/dev/null | head -20
ls .husky 2>/dev/null && sed -n '1,80p' .husky/pre-commit 2>/dev/null
```

Record whether CI exists, uses the same local commands and truly blocks merges.

## 8. Observability

```bash
git grep -lE 'zap\.|logrus|slog\.|winston|pino|getLogger' -- '*.go' '*.ts' '*.py'
git ls-files | grep -iE '(logger|logging)\.(go|ts|py)$|pkg/logger|lib/logger'
git grep -nE '(logger|log)\.(Info|Warn|Error|info|warn|error)\(' | head -20
git grep -lE 'prometheus|opentelemetry|otel' | head
```

Identify the project-owned wrapper, current call shape, bare bypasses, and whether metrics/tracing infrastructure actually exists.

## Convert scan to decisions

Create one recommendation row only when the evidence changes an action. Each row contains action, quantified evidence and cost. Keep raw samples for challenge/verification; do not dump them into the user report. The scan itself changes no file.

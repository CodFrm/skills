# Scan an existing project

Run each item read-only. Return a count, three `file:line` samples, and one conclusion. Use tracked content and ecosystem-relevant commands.

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

Check whether CLAUDE.md duplicates AGENTS.md. Count broken links and documented identifiers absent from non-Markdown tracked code.

## 3. Repeated implementations

Count matching lines and files; inspect samples before reporting scale:

```bash
git grep -nE '#[0-9a-fA-F]{3,8}\b' -- '*.tsx' '*.jsx' '*.css' '*.vue'
git grep -n 'console\.log(' -- '*.ts' '*.tsx' '*.js'
git grep -nE '\bfmt\.Print|"log"' -- '*.go'
git grep -nE '\bprint\(' -- '*.py'
git grep -lniE 'logger|notify|toast|formatDate' -- '*/lib/*' '*/pkg/*' '*/utils/*'
```

Describe `wc -l` as matching lines, not occurrences. Recommend: 0 = lock in; 1–20 = fix then gate; 20–200 = ratchet; 200+ = first verify a sanctioned convention.

## 4. Recurring failures

```bash
git log --oneline --grep='fix' -i -200
git log --format= --name-only -300 | grep -v '^$' | sort | uniq -c | sort -rn | head -15
git log --oneline -300 | grep -icE 'revert|hotfix'
```

Group repeated fix classes and repaired files; rank them above generic recommendations.

## 5. Tests

```bash
git ls-files | grep -cE '\.(test|spec)\.[jt]sx?$|_test\.go$|test_.*\.py$'
git ls-files | grep -E '\.(test|spec)\.|_test\.go$' | head -10
git grep -lnE 'expect\(mock[A-Za-z]*\)\.toHaveBeenCalled\(\)$' -- '*.test.*'
```

Treat suspicious patterns as sampling leads. Record runner, naming/location, low-value signals, and shared mocks.

## 6. E2E and verification

```bash
ls -d e2e tests/e2e cypress playwright 2>/dev/null
git ls-files | grep -E '^e2e/' | head -20
grep -n 'testIgnore\|testDir' playwright*.config.* 2>/dev/null
grep -n 'e2e/scratch\|^\.env$' .gitignore 2>/dev/null
```

Record runtime form, mechanical smoke/scratch separation, and the real-runtime evidence path.

## 7. Gates

```bash
ls -d .github/workflows .gitlab-ci.yml .circleci 2>/dev/null
grep -rhE '^\s+- (run|uses):' .github/workflows/*.y*ml 2>/dev/null | head -20
ls .husky 2>/dev/null && sed -n '1,80p' .husky/pre-commit 2>/dev/null
```

Record whether CI uses local commands and blocks merges.

## 8. Observability

```bash
git grep -lE 'zap\.|logrus|slog\.|winston|pino|getLogger' -- '*.go' '*.ts' '*.py'
git ls-files | grep -iE '(logger|logging)\.(go|ts|py)$|pkg/logger|lib/logger'
git grep -nE '(logger|log)\.(Info|Warn|Error|info|warn|error)\(' | head -20
git grep -lE 'prometheus|opentelemetry|otel' | head
```

Identify the project wrapper, call shape, bypasses, and existing metrics/tracing infrastructure.

## Convert scan to decisions

Create a recommendation row only when evidence changes an action. Include action, quantified evidence, and cost; retain raw samples for verification. The scan changes no file.

# Ready-made recipes: Go

> The method for building guardrails is in [`lint-harness.md`](./lint-harness.md). This file is code you can copy directly.

---

## 1. The architectural dependency gate (using `go test`)

Check first whether an existing tool is sufficient (`depguard` inside golangci-lint can configure import bans). If it is, do not write your own. When it is not (you need directory prefixes, an exemption list, or a custom criterion), use the following.

```go
// internal/archtest/checker.go — or just put it in checker_test.go
//
// Package archtest mechanises the decidable architectural conventions from AGENTS.md /
// docs/architecture.md into a go test gate: the docs describe, and the scanning test here
// enforces.
// The rule table and the whole-repository scan are in conventions_test.go; this file is the
// checker implementation and its guard unit tests (asserting in both directions: violations
// must be reported, and exemptions and compliant code must not be).
package archtest

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strconv"
	"strings"
)

type violation struct {
	file    string // repo-relative path (slash separated)
	line    int
	message string
}

// importBanRule bans files under a directory (prefix) from importing the given paths and their
// subpackages.
type importBanRule struct {
	dir       string          // repo-relative path prefix; "" means the whole repository
	banned    []string        // import paths; subpackages are matched too by default
	exact     bool            // match only banned itself (e.g. ban "log" while allowing "log/slog")
	skipTests bool            // whether to allow *_test.go (e.g. when tests need to inject a mock repo)
	exempt    map[string]bool // repo-relative paths; existing debt or documented exceptions, only shrinks
	message   string
}

func (r importBanRule) applies(path string) bool {
	if r.dir != "" && !strings.HasPrefix(path, r.dir) {
		return false
	}
	if r.skipTests && strings.HasSuffix(path, "_test.go") {
		return false
	}
	return !r.exempt[path]
}

// bannedImport reports whether an import path hits banned itself (when exact) or a subpackage;
// an unrelated package with a similar prefix (repositoryx, say) does not hit.
func bannedImport(path string, banned []string, exact bool) bool {
	for _, b := range banned {
		if path == b || (!exact && strings.HasPrefix(path, b+"/")) {
			return true
		}
	}
	return false
}

func (r importBanRule) check(f *parsedFile) []violation {
	var out []violation
	for _, imp := range f.ast.Imports {
		p, err := strconv.Unquote(imp.Path.Value)
		if err != nil {
			continue
		}
		if bannedImport(p, r.banned, r.exact) {
			out = append(out, violation{
				file:    f.path,
				line:    f.fset.Position(imp.Pos()).Line,
				message: r.message,
			})
		}
	}
	return out
}
```

The rule table — **each entry states its message and points back at the documentation**:

```go
// internal/archtest/conventions_test.go
var importBans = []importBanRule{
	{
		dir:       "internal/app/",
		banned:    []string{"github.com/<org>/<repo>/internal/repository"},
		skipTests: true,
		exempt: map[string]bool{
			// Existing debt, only shrinks. Frozen 2026-07-18.
			"internal/app/legacy.go": true,
		},
		message: "internal/app must not call repository directly; fetch through the corresponding domain service (AGENTS.md → depend on interfaces, call the getter)",
	},
	{
		dir:     "internal/app/",
		banned:  []string{"gorm.io/gorm", "github.com/<org>/<repo>/internal/db"},
		message: "internal/app must not depend on GORM / the internal db directly; data access goes service → repository (AGENTS.md)",
	},
	{
		banned:  []string{"log"},
		exact:   true, // ban the standard library log while allowing log/slog
		message: "business code does not use the standard library log; use <project logger> (prefer logger.Ctx; docs/develop.md → logging conventions)",
	},
}

func TestImportBans(t *testing.T) {
	files := parseRepo(t)
	for _, rule := range importBans {
		for _, f := range files {
			if !rule.applies(f.path) {
				continue
			}
			for _, v := range rule.check(f) {
				t.Errorf("%s:%d: %s", v.file, v.line, v.message)
			}
		}
	}
}
```

### The guard test (required)

The rule itself gets asserted in both directions too, or a broken `applies()` silently disables the whole gate:

```go
func TestCheckerCatchesViolation(t *testing.T) {
	f := parseSource(t, "internal/app/foo.go", `
package app
import "github.com/<org>/<repo>/internal/repository"
`)
	rule := importBans[0]
	if !rule.applies(f.path) {
		t.Fatal("the rule should apply to files under internal/app")
	}
	if got := rule.check(f); len(got) == 0 {
		t.Error("a violating import must be reported")
	}
}

func TestCheckerAllowsSanctioned(t *testing.T) {
	// ① compliant code must not be reported
	f := parseSource(t, "internal/app/foo.go", `
package app
import "github.com/<org>/<repo>/internal/service"
`)
	if got := importBans[0].check(f); len(got) != 0 {
		t.Errorf("a compliant import should not be reported: %v", got)
	}

	// ② an unrelated package with a similar prefix must not be reported
	f2 := parseSource(t, "internal/app/bar.go", `
package app
import "github.com/<org>/<repo>/internal/repositoryx"
`)
	if got := importBans[0].check(f2); len(got) != 0 {
		t.Errorf("an unrelated package with a similar prefix should not be reported: %v", got)
	}

	// ③ exempted files must not be checked
	if importBans[0].applies("internal/app/legacy.go") {
		t.Error("a file on the exemption list should not be checked")
	}
}
```

**Verify manually once before delivering**: change one rule's `banned` to a path that does not exist → run the guard test → confirm it goes red → restore.

---

## 2. golangci-lint configuration points

```yaml
# .golangci.yml
linters:
  enable:
    - depguard      # import bans (enough for simple cases; no need to write archtest yourself)
    - forbidigo     # ban specific identifiers, e.g. fmt.Print / panic
    - errcheck      # unhandled errors — matching the "do not swallow errors" principle
    - govet
    - staticcheck

linters-settings:
  depguard:
    rules:
      app-layer:
        files: ["**/internal/app/**"]
        deny:
          - pkg: "gorm.io/gorm"
            desc: "internal/app must not depend on GORM directly; data access goes service → repository (AGENTS.md)"
  forbidigo:
    forbid:
      - p: "^fmt\\.Print.*$"
        msg: "use <project logger>, not fmt.Print (docs/develop.md → logging conventions)"

issues:
  # Existing exemptions only shrink; each states its reason and freeze date
  exclude-rules:
    - path: "internal/app/legacy.go"
      linters: [depguard]
      text: "gorm"
      # Existing debt, frozen 2026-07-18, only shrinks
```

`desc` / `msg` is where the corrective diagnostic goes.

---

## 3. Common Go-side conventions and how to mechanise them

| Convention | How to mechanise it |
|---|---|
| Layered dependency direction | `depguard` or an archtest scan |
| Critical flows must log, with a consistent prefix format | An archtest scan of logger calls inside function bodies |
| No standard library log / fmt.Print | `depguard` (exact match) / `forbidigo` |
| Do not swallow errors | `errcheck` + review (cannot be fully mechanised) |
| Migrations are append-only, editing history is banned | A CI script comparing the migration files' git history |
| Generated files in sync with their source | Regenerate in CI then `git diff --exit-code` |
| Repository unit tests do not connect to a real database | An archtest scan for real DB driver imports in test files |

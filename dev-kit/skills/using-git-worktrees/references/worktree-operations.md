# Worktree operations

## Detect a linked worktree

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
git rev-parse --show-superproject-working-tree
```

Different Git paths plus an empty superproject result identifies a linked worktree. A non-empty superproject result identifies a submodule instead.

## Create and connect

When no native tool exists:

```bash
git check-ignore -q <location>
git worktree add <location>/<name> -b <branch>
```

Inside a linked worktree, connect the repository's shared DevKit state:

```bash
ln -s "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.dev-kit" .dev-kit
readlink .dev-kit
```

## Move the approved spec

```bash
mkdir -p docs/specs
test ! -e "docs/specs/<spec-slug>.md"
mv "<original-checkout>/docs/specs/<spec-slug>.md" "docs/specs/<spec-slug>.md"
git add "docs/specs/<spec-slug>.md"
git commit -m "docs: spec for <short name>"
```

Add only the spec path; never use `git add -A` because the checkout may contain unrelated work.

## Remove an approved target

```bash
cd <main-repository-root>
git worktree list
git worktree remove <exact-path>
git worktree prune
git branch -d <branch>
```

Inventory again after removal. Use force only after the approval required by the skill.

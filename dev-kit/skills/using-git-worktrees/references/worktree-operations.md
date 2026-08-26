# Worktree operations

## Detect a linked worktree

```bash
git rev-parse --path-format=absolute --git-dir
git rev-parse --path-format=absolute --git-common-dir
git rev-parse --show-superproject-working-tree
```

Different Git paths plus an empty superproject result identifies a linked worktree. A non-empty superproject result identifies a submodule instead. Run each command on its own and compare the output yourself: an isolated session refuses a command whose substitutions hide what it targets.

## Create and enter

From the original checkout:

```bash
git check-ignore -q <location>
git worktree add <location>/<name> -b <branch>
mkdir -p <location>/<name>/.dev-kit/plans
```

Then enter that exact path with the native tool when one is exposed, rather than letting it create a second workspace.

## Move the approved spec

```bash
mkdir -p docs/specs
test ! -e "docs/specs/<spec-slug>.md"
mv "<original-checkout>/docs/specs/<spec-slug>.md" "docs/specs/<spec-slug>.md"
git add "docs/specs/<spec-slug>.md"
git commit -m "docs: spec for <short name>"
```

Add only the spec path; never use `git add -A` because the checkout may contain unrelated work.

## Copy the round's state back

From the original checkout, after leaving the workspace. `-n` keeps every existing destination file, so the diffs are what catch a path that was skipped because a stale copy sat there:

```bash
cp -Rn <workspace>/.dev-kit/plans/<spec-slug>.yaml .dev-kit/plans/
cp -Rn <workspace>/.dev-kit/reviews/<spec-slug> .dev-kit/reviews/
cp -Rn <workspace>/.dev-kit/artifacts/<spec-slug> .dev-kit/artifacts/
cp -Rn <workspace>/e2e/scratch/<spec-slug> e2e/scratch/
diff -r <workspace>/.dev-kit/plans/<spec-slug>.yaml .dev-kit/plans/<spec-slug>.yaml
diff -r <workspace>/.dev-kit/reviews/<spec-slug> .dev-kit/reviews/<spec-slug>
diff -r <workspace>/.dev-kit/artifacts/<spec-slug> .dev-kit/artifacts/<spec-slug>
diff -r <workspace>/e2e/scratch/<spec-slug> e2e/scratch/<spec-slug>
```

Skip a path the round never wrote. A non-empty diff is the conflict the skill stops on.

## Remove an approved target

```bash
cd <main-repository-root>
git worktree list
git worktree remove <exact-path>
git worktree prune
git branch -d <branch>
```

Inventory again after removal. Use force only after the approval required by the skill.

---
name: using-git-worktrees
description: >-
  Use after the user says a spec draft has no remaining problem and it needs its round branch, before a spike or refactor that may be thrown away, or when the workspace holds unrelated uncommitted changes — isolates the round in its own git worktree and branch. Use it again at the end of the round, to deliver that branch.
---

# Isolating a workspace with git worktree

This skill owns two transitions: approved draft → isolated prepared branch, and verified branch → user-selected delivery.

## When to use / when not to

| Use | Do not use |
|---|---|
| An approved draft and its implementation must travel on one branch | Read-only work or a one-off settled edit |
| A spike/refactor may be discarded | Already isolated; reuse that workspace |
| The current checkout holds unrelated changes | The user declined isolation or instructions forbid it |

Never implement directly on `main` or `master`; if no worktree is used, create a dedicated branch.

## Step 0: are you already isolated, and does the user want one?

### 0a · Detect an existing isolated workspace

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
git rev-parse --show-superproject-working-tree
```

Different Git paths plus an empty superproject result means a linked worktree. Reuse it and continue at [setup](#set-up-and-check-the-baseline-before-the-first-change). Otherwise continue to 0b. Do not mistake a submodule for a worktree.

### 0b · Ask, once

If a plan or user instruction already records the choice, follow it. A project with no declared dependencies, lockfile or installed-modules directory has zero reinstall cost; report that check and proceed. Otherwise ask once whether to create a worktree, stating that dependencies must be reinstalled. No → create a dedicated in-place branch and continue at setup.

Keep the approved spec draft uncommitted in the original checkout. Record its absolute path; do not commit it to the baseline or sweep unrelated changes into the round.

## Step 1: create the workspace

### 1a · Use the harness's own worktree tool where there is one

Use a native worktree tool when exposed, then continue at [setup](#set-up-and-check-the-baseline-before-the-first-change). Do not also run `git worktree add`.

### 1b · `git worktree add`, when there is no native tool

```bash
git worktree add <location>/<name> -b <branch>
```

- Derive `<name>` from [the spec slug](../brainstorming/SKILL.md#file-naming); preserve the repository's branch prefix.
- Choose location in order: user/project instruction; existing `.worktrees` or `worktrees`; otherwise `.dev-kit/worktrees/`. Never use `/tmp` or a path outside the repository.
- Before creation, require `git check-ignore -q <location>`. If not ignored, add and commit the ignore rule first.
- On a sandbox failure, report it and use a dedicated branch in the current checkout; do not force.

## Set up and check the baseline before the first change

Every path enters this state in the checkout that will hold the implementation.

### Link `.dev-kit` into the workspace

For a linked worktree:

```bash
ln -s "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.dev-kit" .dev-kit
readlink .dev-kit
```

For an in-place branch, keep the real `.dev-kit` directory. Verify `.dev-kit/artifacts/` is reachable. The ignore entry must be `.dev-kit`, not `.dev-kit/`, because the trailing slash does not match a symlink.

Return to [`brainstorming`](../brainstorming/SKILL.md#finish-the-draft-then-commit-it-on-the-round-branch) to move and commit the approved spec. Then install dependencies with the repository's real command and copy required gitignored runtime configuration. Ask for values that cannot be reconstructed; never invent them.

Run the full baseline before implementation:

- Green → record command, exit code and observation; continue.
- Red → report the failures and ask whether to investigate or proceed with the dirty baseline.
- A result that changes requirements/testing decisions → return to `brainstorming`, revise and re-approve the spec, then commit that revision.

Otherwise continue from [`brainstorming` route selection](../brainstorming/SKILL.md#what-happens-after-the-spec).

## Delivery and cleanup

Enter only after review-and-fix wrap-up finishes and runtime verification has run or the user declined it.

1. Run the full suite on the exact delivery tree. Stop on red.
2. Resolve the baseline from `origin/HEAD`, branch reflog and `git merge-base`; ask only if those cannot settle it. Report the baseline and commit count.
3. Before any menu, report every non-hold, blocked task, standing finding and unobserved requirement; explicitly say when none remain.
4. Offer the user a recommendation and wait:

```text
1. Push and open a PR
2. Merge into <baseline> locally
3. Leave the branch and worktree in place
```

5. Execute only the selected option:

- PR: push the branch, open the PR by repository convention, include the step-3 verdicts, report the URL, and keep the worktree for feedback.
- Merge: merge locally, rerun the full suite on the merge result, and stop without cleanup if red.
- Leave: report branch and worktree paths.

6. Remove a worktree only after a green merge or explicit instruction to discard it. Resolve the exact path with `git worktree list`; use the native cleanup tool when it created the workspace. Otherwise:

```bash
cd <main repo root>
git worktree list
git worktree remove <exact path>
git worktree prune
git branch -d <branch>
```

Never remove another worktree or clear `.dev-kit/`. Before force-deleting a branch/worktree, list the exact path, branch and commits that will be lost and obtain approval.

## After delivery: PR feedback goes back through the chain

Keep the existing round worktree. Route feedback by effect:

- New/changed behaviour, design change or multi-file scope → `brainstorming` and a new approved round.
- Settled small correction → TDD/appropriate verification, [two review-and-fix axes](../executing-plans/SKILL.md#wrap-up-two-review-and-fix-axes), [runtime verification](../executing-plans/SKILL.md#runtime-verification-the-main-session-drives-it), then delivery again.

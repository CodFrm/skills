---
name: using-git-worktrees
description: >-
  Use after the user says a spec draft has no remaining problem and it needs its round branch, before a spike or refactor that may be thrown away, or when the workspace holds unrelated uncommitted changes — isolates the round in its own git worktree and branch. Use it again at the end of the round, to deliver that branch.
---

# Isolating a workspace with git worktree

**This skill runs twice in a round** — once after the user says the spec draft has no remaining problem, to isolate, commit it and prepare the baseline; once at the end, to deliver. You arrive the first time from [`brainstorming`](../brainstorming/SKILL.md#order), and the second time from [wrap-up](../executing-plans/SKILL.md#handing-it-back).

A worktree shuts this round into its own directory and its own branch, so stopping midway does not mean resetting the main workspace. **What it isolates is this round from the other things you have in hand, not two parallel tasks from each other** — parallel work shares one worktree.

## When to use / when not to

| Use | Do not use |
|---|---|
| A spec draft has no remaining problem and its formal spec plus implementation should travel as one branch | One-off small changes, read-only exploration |
| Trying a path that may be thrown away entirely (a big refactor, swapping a library, a spike) | You are **already** in an isolated workspace — see step 0a; do not nest one inside another |
| The current workspace holds uncommitted changes unrelated to this round | This round needs main-workspace changes that are **not committed and not going to be** |
| | The user declined one, or their instructions say not to |

**What is deliberately not on this list: an estimate of whether reinstalling dependencies is worth it.** How long an install takes, whether `.env` can be regenerated, how big the build cache is — none of them are readable from the code. So it is asked, once (step 0b).

One exception, a lookup rather than a loophole: a project that installs nothing. No dependencies declared, no lockfile, no installed-modules directory → the cost is a findable zero, and [gate 1 says look it up rather than ask](../using-dev-kit/references/asking-users.md#three-tiers-findable--cheap-if-wrong--rework-if-wrong). Say what you checked and carry on. Anything short of all three and the question stands.

Even without a worktree, **do not work directly on main / master**: open at least a branch dedicated to this round.

## Step 0: are you already isolated, and does the user want one?

### 0a · Detect an existing isolated workspace

Your harness may have put you in one already (an `EnterWorktree`-style tool, a `--worktree` flag, a cloud workspace). It does not look any different from the inside.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
git rev-parse --show-superproject-working-tree   # non-empty = this is a submodule, not a worktree
```

`GIT_DIR` differing from `GIT_COMMON` **and** the third command printing nothing means you are already in a linked worktree. Report where and on what branch, then go to [the setup section](#set-up-and-check-the-baseline-before-the-first-change) — do not create another, and **follow its link, spec-commit and baseline order yourself**: a workspace created for a different round did none of them on this round's behalf. The submodule guard matters because a submodule produces the same inequality for a different reason, and treating one as a worktree means cutting a branch in the wrong repository.

Equal paths, or a non-empty superproject, means an ordinary checkout → 0b.

### 0b · Ask, once — do not estimate

**Running under a plan? The decision is taken, not asked** — the plan records the workspace, and [`executing-plans`](../executing-plans/SKILL.md#starting-the-run) checks it against the checkout.

If your instructions already state a preference, honour it without asking. Otherwise ask, in one line, and wait:

> "Shall I set up an isolated worktree for this? It keeps your current branch and working tree untouched. It does mean reinstalling dependencies in the new directory."

- Yes → step 1.
- No → work in place, but **still not on main / master**: create and switch to a branch dedicated to this round before returning to `brainstorming`, then continue through setup in that checkout.

## Before creating: keep the commit out of the baseline

The final `docs/specs/<spec-slug>.md` in the original checkout is an uncommitted draft. **Do not commit it on the baseline as a bridge into the worktree.** Record its absolute path before creating the round branch; `brainstorming` moves that file into the new workspace for the first commit.

Anything except that named draft already changed in the original checkout is not input to sweep into the new branch. Never hide unrelated baseline changes inside the spec commit.

**`.dev-kit/` is gitignored**, so [the link](#link-dev-kit-into-the-workspace) is how mockups and later plans remain visible inside the workspace.

## Step 1: create the workspace

### 1a · Use the harness's own worktree tool where there is one

Before reaching for `git worktree add`, check whether you already have a way to create one — a tool named something like `EnterWorktree` or `WorktreeCreate`, a `/worktree` command, a `--worktree` flag. If you do, use it and **skip to [the setup section](#set-up-and-check-the-baseline-before-the-first-change) — skip 1b, not the setup.** What the tool hands you is a checked-out branch and nothing else: the `.dev-kit` link, the dependencies and the baseline run are still yours.

**Running `git worktree add` alongside an available native tool produces a workspace the harness does not know exists** — its worktree commands will not see it and its cleanup will not remove it, and nothing tells you at the time.

### 1b · `git worktree add`, when there is no native tool

```bash
git worktree add <location>/<name> -b <name>
```

- `<name>` is [the spec's slug](../brainstorming/SKILL.md#file-naming) — its `<short-name>` half, for the directory and the branch both. With no spec, take a slug of the same shape (today's date plus a short name) and say so. Where the project prefixes branches (`feat/` — read `git branch -a`), the branch gets the prefix and the directory does not.
- `<location>` is whatever this project already does, checked in this order: a location your instructions state; then `ls -d .worktrees worktrees 2>/dev/null` (if both, `.worktrees` wins); then `.dev-kit/worktrees/`. **Never `/tmp` or anywhere outside the repository.**
- **The location has to be ignored before anything is created** — `git check-ignore -q <location>`, and where it is not, add the line and commit that change first. An unignored workspace puts the entire tree into `git status`, and an uncommitted ignore rule works on this machine only.
- The branch is created fresh — the same branch cannot be checked out in two workspaces at once.

If `git worktree add` fails on a sandbox permission error, do not retry with force: say the sandbox blocked it, work in the current directory on a dedicated branch, and run the setup and baseline in place.

## Set up and check the baseline before the first change

**Every path arrives here** — the native tool's workspace, `git worktree add`'s, one step 0a found you already standing in, and the dedicated in-place branch chosen at step 0b. Every command below runs from the checkout that will hold the committed spec.

### Link `.dev-kit` into the workspace

**Required from the first entry.** `.dev-kit/` is gitignored, so none of the design artifacts travels automatically; later, `.dev-kit/plans/<slug>.yaml` is what the implementation works from and the one file the orchestrator writes status into. Without the link, mockups disappear from the round workspace and the obvious workaround leaves duplicate artifact or plan trees that never line up again.

In a linked worktree, create the link:

```bash
# from the workspace root
ln -s "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.dev-kit" .dev-kit
```

**Compute the target; do not count `../` from memory.** `--git-common-dir` resolves to the *main* repository's `.git` from inside any linked workspace, so its parent is the repo root wherever the workspace was put — and a native tool may have placed it somewhere you did not choose, where a memorised relative path lands on a real directory one level short. In an in-place branch, `.dev-kit` is already the real directory: verify it and do not replace it with a link.

For a linked worktree, check the link resolves with `readlink .dev-kit`; on every path, check `ls .dev-kit/artifacts/` and create `plans/` when planning starts. On Windows `ln -s` needs Developer Mode or an elevated shell; otherwise use `mklink /D`. `--path-format` needs git 2.31+; on an older git, count the relative form.

One trap: **`.dev-kit/` with a trailing slash in `.gitignore` does not cover this symlink** — a trailing slash matches only directories, so `git status` grows a permanent `?? .dev-kit` and `git add -A` commits it. Write `.dev-kit`.

### Commit the spec, then install and run the baseline

Return to [`brainstorming`](../brainstorming/SKILL.md#finish-the-draft-then-commit-it-on-the-round-branch) to move the final draft into this workspace and commit it. The user's review already finished before this workspace was created; continue into setup without asking them to approve the same spec again.

```bash
# whichever the project actually uses
npm install / pnpm install / cargo build / pip install -r requirements.txt / poetry install / go mod download
```

Copy across anything gitignored the project needs to run — `.env` in particular. Ask the user for whatever cannot be reconstructed rather than inventing values.

Then run the test suite once, before touching anything:

- **Green** → report it and start. Every failure from here belongs to this round.
- **Red** → report which tests fail and **ask whether to proceed or investigate first.** A dirty baseline makes every later failure ambiguous, and `test-driven-development` cannot tell a regression from a baseline failure without one.

If the baseline exposes a fact that changes the problem, scope or testing decisions, return to `brainstorming`, revise the formal spec, get approval and commit that revision by path. Otherwise setup is done; continue from [`brainstorming`'s route selection](../brainstorming/SKILL.md#what-happens-after-the-spec). You come back to this skill at [delivery](#delivery-and-cleanup).

## Delivery and cleanup

After the implementation is complete and verified — not the moment the last test goes green.

**1. Run the full test suite again on the tree you are about to deliver.** "It was green a moment ago" only proves the tree it ran on. Red → stop and report: the menu only appears once it is green.

**2. Work out the baseline branch yourself; ask only if you cannot.**

```bash
git symbolic-ref --short refs/remotes/origin/HEAD    # the remote's default branch — start here
git reflog show <branch-name> | tail -1              # "branch: Created from <X>" — where this branch was cut
```

Say what you worked out and what it came from, then carry on. Only with both empty do you ask.

The two answer different questions. `origin/HEAD` names the branch you are delivering *into*; the reflog names where this branch was *cut from*. Where an earlier commit went straight onto the baseline, a range starting at the reflog point **silently omits it**. Take `git merge-base HEAD <baseline>`, and say how many commits it covers.

**3. Say what [wrap-up](../executing-plans/SKILL.md#handing-it-back) left open — before the options, not after**, since the user rules on delivery knowing it. Three lines, not a report.

**Nothing open is also one line, and it is worth the line** — "all 9 requirements hold, no findings left standing" and silence look identical. Say it rather than pointing at the files: the evidence sits under gitignored `.dev-kit/` or `e2e/scratch/`, so these lines are the only form in which it reaches the user.

Where the round never went through wrap-up — work someone else built, a branch handed to you mid-flight — say in one line what evidence there is instead: the suite you just ran, and whether anything other than you read this diff.

**4. Give the user the options — with your recommendation and the basis for it:**

```
Implementation complete. What should happen to this branch?

1. Push it and open a PR  ← recommended: this repo has a remote, and the last
   20 merges into main all arrived through PRs (git log --merges --oneline)
2. Merge back into <baseline branch> (locally)
3. Leave it for now, I will handle it
```

How to pick: a remote plus a PR-shaped history → PR; no remote, or a history of direct commits → local merge; the user wanting to look it over → leave it. **Give the menu, then wait — do not act on your own recommendation.**

**5. Do what they chose:**

- **Merge** — merge, then run the tests again on the merge result, and **only delete anything once that is green**. Red merge result → stop; nothing has been pushed.
- **Open a PR** — `git push -u origin <branch-name>`, open it per the project's convention, report the URL. **Put step 3's lines in the PR description**: `.dev-kit/` is gitignored, so that is the only copy which outlives this machine. Keep the worktree — PR feedback still has to be addressed there.
- **Leave it** — report the branch name and the worktree path.

**6. Cleanup — only after the merge is complete, or the user says to throw it away.** Where a native tool created the workspace, use that tool's cleanup. Otherwise:

```bash
cd <main repo root>                    # you cannot stand inside the worktree and delete it
git worktree list                      # the path this round created, in git's own words
git worktree remove <location>/<name>  # refused when there are uncommitted changes
git worktree prune
git branch -d <the branch>
```

**Clean up only the one you created this time** — read the path off `git worktree list` rather than assuming, since [the location followed the project's convention](#1b--git-worktree-add-when-there-is-no-native-tool). Other entries are someone else's workspace. **Do not clear `.dev-kit/` with `rm -rf`**: workspaces live inside it. To throw away a branch, list what is being lost first — branch name, commits, worktree path — and only then `git branch -D`.

## After delivery: PR feedback goes back through the chain

**A PR is opened, not finished, and by then nothing is holding the branch.** The round is closed, so the next session finds a finished round and no skill claiming the work — and what follows is the branch being edited straight from a review comment: no slice, no evidence bar, no second reader. **The round does not reopen.** Routing is this skill's job, because it opened the PR and will eventually clean up the worktree.

Route by size, size meaning what it asks for rather than how long it is:

- **Substantial** — behaviour nobody agreed, a design the reviewer wants changed, work spanning several files. It re-enters the chain at the top, [`brainstorming`](../brainstorming/SKILL.md), and gets a plan of its own from there.
- **Small** — a rename, a missed edge case, one line of docs, a test the reviewer wants. Take it straight, under the [two static reviews](../executing-plans/SKILL.md#wrap-up-two-static-reviews-at-once) and the [fresh runtime verifier](../executing-plans/SKILL.md#runtime-verification-a-fresh-third-subagent).

**Neither route lowers the bar.** Every commit on the branch cleared the evidence bar and was read by somebody who did not write it; a fix typed in because "the PR is basically done" clears neither.

The worktree stays put through both routes — you are already isolated, so step 0a applies — and it goes when the PR lands or the user says so. Where it was already removed, the substantial route starts again at step 0. Neither route works on main / master.

## Red Flags

| Thought | Reality |
|---|---|
| "Obviously not in a worktree already — no need to check" | A harness-created workspace and a submodule both look like an ordinary checkout by eye. Run step 0a. |
| "`git worktree add` is quicker than hunting for a native tool" | It creates a workspace the harness cannot see or clean up, and nothing tells you at the time. |
| "Commit the draft here first so the new worktree receives it" | That puts the round's first commit on the baseline. Move the final draft and commit it in the round workspace. |
| "The tests went green just now, merge it" | That green proves the tree it ran on. Run it again on the tree being delivered, and on the merge result. |
| "The round is finished, so this review comment is just a quick edit" | It feels quick because nothing is holding the branch. Route it by size; the bar is unchanged. |

---
name: using-git-worktrees
description: >-
  Use when this round of work needs shutting into an isolated workspace — implementing an approved spec, which spans several commits; trying a path that may be thrown away entirely; or when the current workspace still holds other uncommitted changes. Use it again at the end of such a round, when the branch is finished and has to be delivered. Not for: one-off small changes, read-only exploration, or a workspace that is already isolated.
---

# Isolating a workspace with git worktree

## Why

**Implementing an approved spec spans several commits**, and anything bigger than a slice or two spans several sessions on top of that. Working directly in the current workspace mixes them with whatever else you have in hand: stopping midway means resetting the main workspace, and afterwards "what did this round actually change" cannot be told apart. A worktree shuts this round of work into its own directory and its own branch, and if you do not want it, `git worktree remove` leaves the main workspace untouched.

**What it isolates is "this round of work" from "the other things you have in hand", not "two parallel tasks from each other".** Work running in parallel shares one worktree — one worktree each merely converts an overlapping change surface into several branches waiting to be merged, rather than removing the overlap.

## When to use / when not to

| Use | Do not use |
|---|---|
| Implementing an approved spec (several commits), and all the more so when it breaks into several slices | One-off small changes, read-only exploration |
| Trying a path that may be thrown away entirely (a big refactor, swapping a library, a spike) | You are **already** in an isolated workspace — see step 0a; do not nest one inside another |
| The current workspace holds uncommitted changes unrelated to this round | This round needs main-workspace changes that are **not yet committed and are not going to be** — a worktree cannot see them |
| | The user declined one when asked, or their instructions already say not to |

**What is deliberately not on this list: an estimate of whether reinstalling dependencies costs more than the isolation is worth.** That judgement usually cannot be made from inside the repository — how long an install takes, whether `.env` can be regenerated, how big the build cache is and how fast this machine is are none of them things reading the code will tell you. So it is not estimated; it is **asked**, once, in one line (step 0b).

**One exception, and it is a lookup rather than a loophole: a project that installs nothing.** Where the manifest declares no dependencies, there is no lockfile and no installed-modules directory, the reinstall cost is not unknown — it is a **findable zero**, and [gate 1 says look it up rather than ask](../using-dev-kit/SKILL.md#when-to-ask-the-user-look-it-up-decide-it-and-only-then-ask). Say in one line that you checked and what you found, then carry on. **Anything short of all three, and the question stands** — a lockfile you did not open, or a `.env` this round needs, is the ordinary case, not this one.

Even without a worktree, do not work directly on main / master: open at least a branch dedicated to this round.

## Step 0: are you already isolated, and does the user want one?

**Two questions before anything is created, in this order.** Skipping the first is how a worktree ends up nested inside a worktree; skipping the second is how the decision gets made by guesswork.

### 0a · Detect an existing isolated workspace

Your harness may have put you in one already (an `EnterWorktree`-style tool, a `--worktree` flag, a cloud workspace), or the user may have set one up before starting. It does not look any different from the inside.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
git rev-parse --show-superproject-working-tree   # non-empty = this is a submodule, not a worktree
```

`GIT_DIR` differing from `GIT_COMMON` **and** the third command printing nothing means **you are already in a linked worktree**. Report where and on what branch, then go to [the setup section](#set-up-and-check-the-baseline-before-the-first-change) — do **not** create another, and do not assume whoever made this one did the setup: **check the `.dev-kit` link and the baseline yourself**, because a workspace created for a different round did neither on this round's behalf. The submodule guard matters because a submodule produces the same inequality for an entirely different reason, and treating one as a worktree means cutting a branch in the wrong repository.

Equal paths, or a non-empty superproject, means an ordinary checkout. Continue to 0b.

### 0b · Ask, once — do not estimate

**Running under a plan? The decision is taken, not asked.** [`executing-plans`](../executing-plans/SKILL.md#the-one-gate) folds it into its single gate: it decides against [the criteria above](#when-to-use--when-not-to), states which way it went in one clause alongside the mode question, and lets a word from the user overturn it. The reasoning below still holds for a one-off change, and weakens under a plan for two reasons — a multi-task round is long enough to absorb an install, and the decision is usually forced anyway by uncommitted changes or by standing on main. **Spending a second question on a decision that is usually not a decision is how a gate stops being read.**

**If your instructions already state a worktree preference, honour it without asking.** Otherwise ask, in one line, and wait:

> "Shall I set up an isolated worktree for this? It keeps your current branch and working tree untouched. It does mean reinstalling dependencies in the new directory."

- **Yes** → step 1.
- **No** → work in place, but **still not on main / master**: open a branch dedicated to this round.

**Why this is asked rather than worked out.** The only real argument against a worktree is that dependencies have to be reinstalled there — and how long that takes, whether `.env` can be regenerated, and how big the build caches are are facts about the user's machine and their setup, not about the repository. There is nothing in the code to read them off. One line spent asking beats a confident guess with nothing behind it, and it is the same three-gate rule as everywhere else: not findable, expensive if wrong, so it goes to the user ([asking-users.md](../using-dev-kit/references/asking-users.md)).

## Before creating: the spec has to be committed on the current branch

**A worktree checks out `HEAD`.** Anything this round depends on that is sitting uncommitted in the main workspace simply is not there in the new one — and the first thing that describes is `docs/specs/<spec-slug>.md`, written and approved minutes ago.

```bash
git status --short docs/specs/        # empty = the spec is committed; anything printed = commit it first
```

If it prints a line, commit it **on the branch you are on now, before creating anything** — `brainstorming` owns this step ([its rules](../brainstorming/SKILL.md#the-user-gate-then-commit): the spec file by path, not `git add -A`). Only then cut the branch, so the base already contains the spec.

Cut it the other way round and nothing errors — the worktree comes up fine, and what is missing only shows up one layer down: the requirements the implementation is supposed to satisfy are not in the workspace the implementation happens in — which is also the only thing the round's checks can be built from. **If you have already done it**, do not copy the file across by hand: commit it on the original branch, then bring the worktree up to that commit (`git merge <that branch>` from inside it, or rebase if the branch has no commits yet).

The same test applies to anything else this round needs — a `.env.example` addition, a fixture, a config change made while exploring. Commit it, or accept that the worktree will not see it.

**`.dev-kit/` is the one thing that does not travel this way.** It is gitignored by design, so committing is not its route into the workspace — [the link in the setup section](#link-dev-kit-into-the-workspace) is. Two mechanisms, and it is worth keeping them straight: **the spec is committed so that the worktree checks out its own copy; `.dev-kit/` is linked so that the worktree reads the main repository's plan and artifacts and there goes on being exactly one of each.**

## Step 1: create the workspace

### 1a · Use the harness's own worktree tool where there is one

**Before reaching for `git worktree add`, check whether you already have a way to create one** — a tool named something like `EnterWorktree` or `WorktreeCreate`, a `/worktree` command, a `--worktree` flag. If you do, **use it and skip to [the setup section](#set-up-and-check-the-baseline-before-the-first-change) — skip 1b, not the setup.** What the tool hands you is a checked-out branch and nothing else: **the `.dev-kit` link, the dependencies and the baseline run are still yours**, and the link is the one whose absence does not announce itself — you find out when a mockup you built before cutting is not there, or later, from evidence written into a tree nobody will look in.

A native tool owns placement, branch creation and cleanup, and the harness tracks the workspace it made. Running `git worktree add` alongside it produces a workspace the harness does not know exists: its own worktree commands will not see it, its cleanup will not remove it, and the session may believe it is somewhere it is not. Bypassing an available native tool is the most expensive mistake in this skill, and it is invisible at the time you make it.

### 1b · `git worktree add`, when there is no native tool

```bash
git worktree add <location>/<name> -b <name>
```

Four conventions here, and [a fifth thing every path owes](#link-dev-kit-into-the-workspace) in the setup section below:

- **`<name>` is one name, and it comes from the spec** — the `<short-name>` half of `docs/specs/<YYYY-MM-DD-short-name>.md`. The directory and the branch take the same one. **Two names would be two things to keep in step and nothing declares either**: the spec's slug is the only name any upstream stage produces, so a second invented one is a fact that exists only in the session that invented it. Where the round legitimately has no spec, take a slug of the same shape — today's date plus a short name — and say so. Where the project prefixes its branches (`feat/`, `feature/` — read `git branch -a`), the branch gets the prefix and the directory does not.
- **`<location>` is whatever this project already does, and `.dev-kit/worktrees/` only when it does nothing.** Check in this order, and stop at the first hit: a location your instructions state; then `ls -d .worktrees worktrees 2>/dev/null` (if both, `.worktrees` wins); then `.dev-kit/worktrees/`. A project that already keeps worktrees somewhere and now has them in two places has to have both cleaned up by hand, and only one of them is where anyone looks. **Never `/tmp` or anywhere outside the repository.**
- **Whichever location it is, it has to be ignored before anything is created** — `git check-ignore -q <location>`, and where it is not, **add the line and commit that change first**. An unignored workspace directory puts the entire tree into `git status`, and an *uncommitted* ignore rule is one that only works on this machine. `.dev-kit/worktrees/` needs no rule of its own, since the `.dev-kit` line `init` writes already covers it.
- **The branch is created fresh for this round of work**; do not reuse an existing branch — the same branch cannot be checked out in two workspaces at once.

**If `git worktree add` fails on a sandbox permission error**, do not retry it with escalating force. Say that the sandbox blocked worktree creation, work in the current directory on a dedicated branch instead, and run the setup and baseline below in place.

## Set up and check the baseline before the first change

**Every path arrives here, and all three owe what is in this section**: the native tool's workspace, `git worktree add`'s, and one [step 0a](#0a--detect-an-existing-isolated-workspace) found you already standing in. Only 1b's placement and branch conventions were 1b's alone — a workspace someone else created still needs the link, the dependencies and the baseline, and none of those get done on its behalf. **Every command below runs from inside the workspace**, so `cd` there first if `git worktree add` left you in the main repository; the link command in particular reads the workspace's own git configuration to find its way back.

### Link `.dev-kit` into the workspace

**The link is required whenever this round has a plan.** `.dev-kit/` is gitignored, so none of it travels with the workspace — and `.dev-kit/plans/<slug>.yaml` is what the implementation is working from, and the one file the orchestrator writes status into. Without the link, the workspace cannot see the plan at all, and the obvious workaround — starting a second plan file inside the workspace — leaves two that never line up again. The same link buys `.dev-kit/artifacts/`: the mockups the design was agreed on, this round's evidence and its verification report, and something for `devkit serve` to serve. **With no plan and nothing in `artifacts/` the link is optional**, since the spec itself is committed and therefore present — make it anyway if there is any chance evidence will be written this round.

```bash
# from the workspace root
ln -s "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.dev-kit" .dev-kit
```

**Compute the target; do not count `../` from memory.** `--git-common-dir` resolves to the *main* repository's `.git` from inside any linked workspace, so its parent is the repo root wherever the workspace itself was put — which is the point, because **a native tool may have placed it somewhere you did not choose**, and a memorised relative path then points confidently at nothing. For the `.dev-kit/worktrees/<name>` default the relative form is `../../../.dev-kit`, counting `<name>` → `worktrees` → `.dev-kit` → repo root — and for a project that keeps its worktrees in `.worktrees/<name>` it is `../../.dev-kit` instead, which is exactly why the depth is not a constant worth memorising. One level short lands on a real directory that `ls` will not complain about and none of what you want is in.

**Then check the link resolves before relying on it** — `readlink .dev-kit` and `ls .dev-kit/plans/`. On Windows `ln -s` needs Developer Mode or an elevated shell, and otherwise fails with "operation not permitted"; use `mklink /D` from cmd instead. `--path-format` needs git 2.31 or newer; on an older git, take the relative form above and count.

**One trap: writing `.dev-kit/` with a trailing slash in `.gitignore` does not cover this symlink** — a trailing slash matches only directories, and a symlink is not a directory, so `git status` grows a permanent `?? .dev-kit` and `git add -A` commits it. Drop the slash and write `.dev-kit`, which covers both (`init`'s gitignore template already does, and says why).

### Install, then run the baseline

A new working directory has no dependencies in it, and the first task should not be the thing that discovers that.

```bash
# whichever the project actually uses
npm install / pnpm install / cargo build / pip install -r requirements.txt / poetry install / go mod download
```

Copy across anything gitignored the project genuinely needs to run — `.env` in particular, which by definition did not travel with the checkout. Ask the user for whatever cannot be reconstructed rather than inventing values.

Then **run the project's test suite once, before touching anything**:

- **Green** → report it and start. Every failure from here on belongs to this round of work.
- **Red** → report which tests fail and **ask whether to proceed or investigate first**. Do not start on top of it silently: a dirty baseline makes every later failure ambiguous, and `test-driven-development` cannot tell a regression from a baseline failure without one. "Was this already broken?" is a question nobody can answer afterwards without re-running the whole thing on the base commit.

## Delivery and cleanup

This comes after the implementation is complete and verified — not the moment the last test goes green in isolation.

**1. Run the full test suite again on the tree you are about to deliver.** "It was green a moment ago" does not count — that green only proves the tree it ran on, and anything committed since means re-running. If it is red, stop here and report the failure: **the menu only appears once it is green.**

**2. Work out the baseline branch yourself; ask only if you cannot.** Where this branch was cut from is usually recoverable without spending the user's attention:

```bash
git symbolic-ref --short refs/remotes/origin/HEAD    # the remote's default branch — start here
git reflog show <branch-name> | tail -1              # "branch: Created from <X>" — where this branch was cut
```

The conversation often states it outright as well. **Say what you worked out and what it came from, then carry on.** Merging into the wrong baseline is expensive to undo, which makes it worth one line of evidence — but not worth a question you could have answered yourself. Only with both of those empty (no remote, no reflog entry) do you ask.

**The two answer different questions, and the order matters when this round did not start clean.** `origin/HEAD` names the branch you are delivering *into*. The reflog names the commit this branch was *cut from* — which is the same thing only if nothing from this round had already landed before the branch existed. Where an earlier task was committed straight onto the baseline and the branch was cut afterwards, the reflog points at that commit, and **a review range starting there silently omits it** — from the one pass that was ever going to read this code. So take the range from the baseline branch (`git merge-base HEAD <baseline>`), not from where the branch happens to begin, and **say how many commits it covers** so a missing one is visible rather than merely absent.

**3. Say what wrap-up left open — before the options, not after.** [Wrap-up](../executing-plans/SKILL.md#handing-it-back) — the two dispatched reviews, the fix rounds, the verification report — hands three items over, and they go to the user here, ahead of the menu, because the whole point is that they rule on delivery **knowing** them. Three lines, not a report:

1. every spec requirement whose verdict is not "holds", plus any task left `blocked`;
2. the findings the reviews raised that were let stand rather than fixed, with the reason;
3. which behaviours went unobserved this round — anything the gates could not actually exercise.

**Nothing open is also one line, and it is worth the line** — "all 9 requirements hold, no findings left standing" and silence look identical to the user, and only one of them is a statement anybody can be held to.

Say it rather than pointing at the files, because the files do not leave this machine: anything under `.dev-kit/artifacts/<spec-slug>/` sits inside gitignored `.dev-kit/`, so these lines are the only form in which any of it reaches the user at all.

**Where the round never went through wrap-up as written** — work someone else built, a branch you were handed mid-flight — there is no verdict list to read off, and the menu does not become unusable for it. Say in one line what evidence there is instead: the suite you just ran, and whether anything other than you read this diff. **The gap gets stated, not skipped**; an unmentioned gap reads exactly like no gap.

**4. Give the user the options — with your recommendation and the basis for it:**

```
Implementation complete. What should happen to this branch?

1. Push it and open a PR  ← recommended: this repo has a remote, and the last
   20 merges into main all arrived through PRs (git log --merges --oneline)
2. Merge back into <baseline branch> (locally)
3. Leave it for now, I will handle it
```

**The recommended option goes first, with one line of evidence behind it.** How to pick: a remote plus a PR-shaped history → PR; no remote, or a history of direct commits to the baseline → local merge; the user having already said they want to look it over → leave it. You just ran the full suite on this tree and just looked at how this repository takes changes, so you hold more evidence than the user does — withholding it is not neutrality, it is handing the judgement cost back to them.

**What you must not do is act on your own recommendation.** Delivery is the one call where being wrong is expensive and the cost lands on them. Give the menu, then wait.

**5. Do what they chose:**

- **Merge** — merge first, then **run the tests again on the merge result, and only delete anything once that is green**. If the merge result is red, stop: nothing has been pushed, the branch and worktree stay as they are, and you go find out why.
- **Open a PR** — `git push -u origin <branch-name>`, open it per the project's PR convention, and report the URL. **Put step 3's lines in the PR description as well**: `.dev-kit/` is gitignored, so the PR body is the only copy of them that outlives this machine, and it is where a reviewer will look for what is still open. **Keep the worktree**; PR feedback still has to be addressed there, and [the next section says how](#after-delivery-pr-feedback-goes-back-through-the-chain).
- **Leave it** — report the branch name and the worktree path, and stop.

**6. Cleanup. Only after the merge is complete, or the user explicitly says to throw this away.** Where a native tool created the workspace, use that tool's cleanup rather than the commands below. Otherwise:

```bash
cd <main repo root>                    # you cannot stand inside the worktree and delete it
git worktree list                      # the path this round created, in git's own words
git worktree remove <location>/<name>  # refused when there are uncommitted changes
git worktree prune
git branch -d <the branch>
```

**Clean up only the one you created this time.** `git worktree list` above is there because [the location was chosen against what the project already does](#1b--git-worktree-add-when-there-is-no-native-tool) rather than fixed — so read the path off git rather than assuming `.dev-kit/worktrees/`. Other entries in that list, and worktrees outside the repository, are someone else's or another session's workspace. **Do not clear `.dev-kit/` with `rm -rf`** — workspaces live inside it, so what you delete is work someone else is doing, and git still holds a registered record of it.

**To throw away a whole branch, list what is being thrown away and have the user confirm first**: branch name, commit list, worktree path. Only after they confirm do you `git branch -D` — commits can still be fished out of the reflog for a while, but a deleted worktree is gone.

## After delivery: PR feedback goes back through the chain

**A PR is opened, not finished, and by that point nothing is holding the branch.** Wrap-up has already run and the round is closed, so the next session opens in the worktree you kept, finds a finished round, and no skill claims the work. What follows is the branch being edited straight from a review comment: no slice, no evidence bar, no second reader. **The round does not reopen — finished goes on meaning "that round finished".** Routing what comes back is this skill's job instead, because it is the one that opened the PR, told you to keep the worktree, and will eventually clean it up.

**Route the feedback by size, size meaning what it asks for rather than how long it is:**

- **Substantial** — behaviour nobody agreed, a design the reviewer wants changed, work spanning several files. **It re-enters [the chain](../using-dev-kit/SKILL.md#the-spec-driven-chain-as-far-as-it-currently-goes) at the top**: [`brainstorming`](../brainstorming/SKILL.md) where the requirement itself moved, and a plan of its own from there. A second round is cheap next to a large change built on a comment thread.
- **Small** — a rename, a missed edge case, one line of docs, a test the reviewer wants added. Take it straight, under [what every round owes](../using-dev-kit/SKILL.md#what-every-round-owes-whatever-its-size) and nothing less.

**Neither route lowers the bar, and that is why this section is here.** Every commit already on the branch cleared the evidence bar — a command, an exit code, an observation — and the branch as a whole was read once by somebody who did not write it. A fix typed into the kept worktree because "the PR is basically done" clears neither, and it lands in the same branch the user is about to merge, after the point where anything was still watching. **The invariant has no expiry**: nothing is judged finished inside the context that produced it, so a follow-up commit owes the same dispatched read as everything under it.

**The worktree stays put through both routes** — that is what "keep the worktree" bought — and the round runs inside it rather than around it: you are already isolated, so step 0a applies and there is no second workspace to create. Cleanup is unchanged: **the worktree goes when the PR lands, or when the user says to throw it away**, by step 6 above and nothing sooner. Where it was already removed — the branch merged locally and cleaned up before the feedback arrived — the substantial route starts again at step 0, and the small one rules on a workspace for itself. Neither works on main / master: the rule at the top of this file — a branch dedicated to the round even where there is no worktree — has no exception for a follow-up.

## Red Flags — stop when you catch yourself thinking these

| Thought | Reality |
|---|---|
| "Obviously not in a worktree already — no need to check" | Run step 0a. A harness-created workspace and a submodule both look like an ordinary checkout by eye; the two `rev-parse` commands settle it, and nesting a worktree inside one is how you end up with two branches nobody asked for. |
| "Reinstalling the dependencies is probably fine / probably too slow" | Both halves are a guess. You cannot see how long an install takes, whether `.env` can be regenerated, or how big the build cache is. Ask the one-line question instead of doing arithmetic with numbers you do not have. |
| "Asking about a worktree is a pointless interruption" | It is one line, once, and it decides where every later commit lands. What is pointless is asking a question the instructions already answer — check those first. |
| "`git worktree add` is quicker than hunting for a native tool" | A native tool owns placement, branching and cleanup, and the harness tracks what it made. Going around it creates a workspace the harness cannot see or clean up — and nothing tells you at the time. |
| "The spec is sitting in `docs/specs/`, so the worktree will have it" | Only if it was committed. A worktree checks out `HEAD`, and an uncommitted spec stays behind in the workspace you left. `git status --short docs/specs/` before you cut. |
| "The spec is not in the worktree, copy the file across" | Then the agreed basis exists in two places and neither is in git on the base branch — throw the branch away and the spec goes with it. Commit it on the branch you cut from, then merge that in. |
| "Committing the spec first is working on main" | It is committing the *requirement*, not the implementation. The spec outlives this branch either way, and the branch cut from it carries the commit into the PR. |
| "The worktree directory is surely ignored already" | Check it — `git check-ignore -q <location>` — and where it is not, add the line **and commit it** before creating anything. An unignored workspace directory puts the entire tree into `git status`, and an uncommitted ignore rule works on this machine only. |
| "`.dev-kit/worktrees/` is where worktrees go" | It is the default, not the rule. A project already keeping them in `.worktrees/` or `worktrees/` gets them there — put them somewhere else and it now has two places, both needing cleanup by hand and only one of them where anyone looks. |
| "I need a branch name, I will make one up" | The spec's slug is the only name anything upstream produces, which is why the branch comes off it — one name for the branch and the directory both, plus this project's own branch prefix if it has one. A second invented name is a fact that lives only in this session. |
| "`.dev-kit` keeps showing up in git status, commit it" | That is a symlink pointing back at the main repository, not content. Fix `.gitignore` by dropping the trailing slash. |
| "There is no plan in the worktree, so I will start one here" | What you get is a second plan while the main repository's stays on the old state, and the two never line up again. Make the link first, and `readlink` it — a link pointing one level short resolves to a real directory with nothing in it. |
| "The harness's worktree tool set this up, so it is ready to work in" | It created a branch in a directory. The `.dev-kit` link, the install and the baseline run are all still owed, and the link is the one that fails quietly: the plan is invisible, the agreed mockups are missing, and the round's evidence lands in a tree nobody opens. |
| "`../../../.dev-kit` — that is the path, I have written it before" | It is the path *for the standard location*. A native tool may have put this workspace anywhere, and a relative path counted from the wrong depth still creates a link successfully. Compute the target from `--git-common-dir`. |
| "The symlink failed, so copy the plan file across" | Same outcome by a slower route: two copies, two writers, no way back to one. Fix the link, or read and write `.dev-kit/` from the main repository (`cd` back for those, stay in the worktree for everything else) and say out loud that this workspace has no link. |
| "The symlink failed and this round has no plan — unusable" | Still usable. The spec is committed and therefore present, and with no plan the link only buys the gitignored artifacts. Say it is missing and carry on. |
| "`remove` was refused, add `--force`" | The refusal means there are uncommitted changes inside. Run `git status` and see what they are rather than deleting them outright. |
| "The tests went green just now, merge it" | That green only proves the tree it ran on. Run it again on the tree being delivered, and again on the merge result. |
| "The baseline branch is obviously main" | It counts once you have worked it out — the remote's HEAD, or `git reflog show <branch> \| tail -1` — or asked because both came up empty. Merging into the wrong baseline is expensive to undo. |
| "The reflog says where the branch was cut, so that is the review range" | Only when nothing from this round landed before the branch did. Otherwise that range drops the commits that went onto the baseline first, out of the only pass that reads this code. Take `git merge-base HEAD <baseline>` and state the commit count. |
| "Not sure which baseline, better ask the user" | Take the lookup first. Asking a question the reflog answers trades their time for your thirty seconds — see [asking-users.md](../using-dev-kit/references/asking-users.md). |
| "Implementation complete — straight to the menu" | Complete is not the same as clean. Whatever wrap-up left open — requirements whose verdict is not "holds", tasks left `blocked`, findings let stand, behaviours unobserved — goes over *before* the options, because it is the one input into their decision they cannot look up for themselves: nothing under `.dev-kit/` ever leaves this machine. |
| "This round never went through wrap-up, so there is nothing to say before the menu" | Then that is the one line: what you ran, and whether anyone other than you read this diff. Silence and a clean round are indistinguishable to the person reading them. |
| "The user said 'it is finished', so they want me to merge" | How it is delivered is the user's decision. Give them the three options — with your recommendation — and wait. |
| "Hand the three options over bare; picking for them would be presumptuous" | Give the options *and* the recommendation. You just ran the tests on this tree and just read this repo's merge history — staying silent about that is not neutrality, it is pushing the judgement cost onto them. Recommending is not deciding: you still wait. |
| "The PR is open, the worktree is rubbish now" | PR feedback still has to be addressed there. Keep it until the work actually lands. |
| "The round is finished, so this review comment is just a quick edit" | It feels quick precisely because nothing is holding the branch any more. Route it by size — straight, or a new round through the chain — and either way it clears the same evidence bar and gets the same second reader as every commit already on the branch. |
| "PR feedback means the round should reopen" | Finished means that round finished, and rewriting it to say otherwise costs the one statement anybody can trust. The feedback is new work: route it, do not reopen the old basis. |
| "The merge result's tests failed, probably a flake" | A red merge result stops everything, with the branch and worktree left as they are to investigate. Nothing has been pushed, and stopping now is the cheapest it gets. |
| "Baseline tests can wait, the workspace is fresh" | A dirty baseline makes every later failure ambiguous, and it is exactly the distinction `test-driven-development` has to make on every round. Run them before the first change, and let the user rule on a red one. |
| "This worktree looks unused, clean it up while I am here" | Clean up only the one you created this time. Other workspaces are not yours to manage. |
| "`.dev-kit/` has accumulated a pile of local state, `rm -rf` it" | Worktrees live in `.dev-kit/worktrees/`. Someone else's workspace and its uncommitted changes go with it, and git still holds the registration. To clean up, `git worktree remove` your own. |

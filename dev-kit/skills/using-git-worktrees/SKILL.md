---
name: using-git-worktrees
description: >-
  Use after the user approves a spec draft, before a disposable spike or refactor, or when unrelated changes occupy the checkout. Prepares an isolated round branch, then returns after verification to deliver it.
---

# Isolating and delivering a round workspace

This skill owns approved draft → prepared branch and verified branch → user-selected delivery. [worktree-operations.md](references/worktree-operations.md) owns detection and Git commands.

Never implement on `main` or `master`. Reuse an existing linked worktree for the round; otherwise create a worktree or, when the user declines isolation or instructions forbid it, a dedicated in-place branch.

## Set up and check the baseline before the first change

1. Detect whether the checkout is a linked worktree without mistaking a submodule for one. Reuse it if it belongs to this round.
2. Follow any recorded worktree choice. If none exists, report whether dependencies need reinstalling and ask once whether to create one. Keep the approved spec draft uncommitted in the original checkout and record its absolute path; never commit it to the baseline or sweep unrelated changes into the round.
3. Derive the branch and workspace name from the fixed spec slug, preserving repository branch conventions. Choose a repository-local location from project/user instructions, an existing worktree directory, then `.dev-kit/worktrees/`; never use `/tmp` or an outside path. Create the workspace exactly once — with `git worktree add` or a native worktree tool, never both — then enter it with the native tool when one is exposed. A native tool that creates its own location must still satisfy step 4.
4. Before creating a repository-local worktree, prove its location is ignored. If needed, add and commit the narrow ignore rule first. On sandbox failure, report it and use a dedicated branch in the current checkout; do not force.
5. Give the workspace its own real `.dev-kit/`; never link the repository's, because a session isolated in the workspace refuses to write any path resolving outside it. The round's plan, reviews and artifacts live there until [delivery](#delivery-and-cleanup) copies them back; mockups written before isolation stay readable in the original checkout.
6. Move the approved draft from its recorded path into the absent `docs/specs/<spec-slug>.md` destination, then commit only that path. Stop if the destination exists. If already on the dedicated branch, commit the approved file without moving it.
7. Install dependencies with the repository's real command and copy required gitignored runtime configuration. Ask for values that cannot be reconstructed; never invent them.
8. Run the full baseline before implementation:
   - Green: record command, exit code and decisive observation, then enter [`writing-plans`](../writing-plans/SKILL.md).
   - Red: report failures and ask whether to investigate or proceed with the dirty baseline.
   - A result changes requirements or testing decisions: return to [`brainstorming`](../brainstorming/SKILL.md), re-approve and commit the revision before planning.

## Delivery and cleanup

Enter only after both review-and-fix axes finish and runtime verification has run or the user declined it.

1. Run the full suite on the exact delivery tree; stop on red.
2. Return the session to the original checkout, then copy the round's plan, reviews, artifacts and runtime evidence into it. Overwrite nothing: report a differing destination file and stop. Once the workspace is removed this is the only copy.
3. Resolve the baseline from remote/default-branch evidence and Git history; ask only if evidence cannot settle it. Report the baseline and commit count.
4. Report every non-hold, blocked task, standing finding and unobserved requirement, explicitly stating when none remain.
5. Recommend one option and wait for the user to select it:
   1. Push and open a PR.
   2. Merge into the resolved baseline locally.
   3. Leave the branch and worktree in place.
6. Execute only the selection:
   - PR: push, open it by repository convention, include step 4's verdicts, report the URL and retain the worktree for feedback.
   - Merge: merge locally, rerun the full suite on the result and stop without cleanup on red.
   - Leave: report the exact branch and worktree paths.

### Cleanup and feedback

Remove a worktree only after a green local merge or explicit instruction to discard it. Resolve the exact target through the worktree inventory and use the native cleanup tool if it created the workspace. Never remove another worktree or clear `.dev-kit/`. Before force deletion, list the exact path, branch and commits to be lost and obtain approval. Follow [worktree-operations.md](references/worktree-operations.md) for commands.

Keep the round worktree after PR delivery. New or changed behaviour returns to `brainstorming`; a settled correction repeats TDD, both serial review-and-fix axes, main-session runtime verification and this delivery flow.

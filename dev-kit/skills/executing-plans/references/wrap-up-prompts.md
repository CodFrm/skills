# Wrap-up prompts

Use both at `strong`, read-only, as separate reviews. Run concurrently only after [`executing-plans`' parallel gate](../SKILL.md#parallel-is-proved-not-assumed); otherwise serially. Apply [shared dispatch rules](prompts.md#what-every-dispatch-shares) and [do not bias verdicts](prompts.md#do-not-write-the-verdict-into-either-review-prompt).

## Static spec verification

```text
Statically verify <range> (<n> commits) against <spec path>. Read the complete spec first; its
requirements are in the design prose.

Find only:
- missing/partial agreed behaviour;
- behaviour no spec section asks for, including crossed non-goals;
- behaviour implemented differently from the agreement.

For each finding quote the spec sentence, then give severity (blocking/significant/minor), file:line
and what the diff does instead. If the spec is silent/ambiguous, report that to the orchestrator;
do not decide it.

Do not review code quality or claim runtime observation. Read only. Do not modify the tree/index/HEAD,
fix findings or rerun the suite. One targeted test is allowed only for a specific reading-raised suspicion.

Return findings most severe first, no report file or diff summary. Nothing found is one line.
```

## Code review

```text
Review <range> (<n> commits) as code. Do not read the spec; another review owns agreement.

Find correctness bugs, unhandled edge/error paths, resource/concurrency errors, security exposure,
dead code, tests that assert nothing or implementation details, and branch-wide duplicate/drifting
implementations or interfaces.

For each finding give severity (blocking/significant/minor), file:line, what breaks and the concrete
input/state that triggers it. Rank unproven suspicions separately. Ignore historical size in untouched code.

Read only. Do not modify the tree/index/HEAD or fix findings. Do not rerun the suite; one targeted test
is allowed only for a specific suspicion. Stay in the range except for a named precedent/risk check.

Return findings most severe first, no report file or diff summary. Nothing found is one line.
```

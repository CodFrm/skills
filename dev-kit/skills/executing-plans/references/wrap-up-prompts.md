# Wrap-up prompts

Use both at `strong` and serially. Apply the [shared dispatch and writable-axis contract](prompts.md#writable-wrap-up-axis) without biasing either verdict.

## Spec verification

```text
In <workspace>, verify <range> (<n> commits) against <spec path>. Read the complete spec first; its
requirements are in the design prose. Axis input: pre-head <pre-head>, receipt <receipt>, full suite
<full-suite>, commit convention <commit convention>, write boundary <write boundary>.

Review and own:
- missing/partial agreed behaviour;
- behaviour no spec section asks for, including crossed non-goals;
- behaviour implemented differently from the agreement.

For each finding, quote the spec sentence, give file:line and fix what the diff does instead. Do not
review branch-wide code quality or claim runtime observation. If the spec is silent, decide from
verified precedent unless the observable agreement genuinely requires the user.
```

## Code review

```text
In <workspace>, review <range> (<n> commits) as code. Do not read the spec; another axis owns
agreement. Axis input: pre-head <pre-head>, receipt <receipt>, full suite <full-suite>, commit
convention <commit convention>, write boundary <write boundary>.

Review and own correctness bugs, unhandled edge/error paths, resource/concurrency errors, security exposure,
dead code, tests that assert nothing or implementation details, and branch-wide duplicate/drifting
implementations or interfaces.

For each finding, give file:line, the concrete breaking input/state and fix it. Ignore historical size
in untouched code. Do not claim runtime observation; stay in range except for a named precedent/risk check.
```

## Same-axis confirmation

```text
In <workspace>, independently confirm the completed <spec verification | code review> axis over
<range> at exact HEAD <pre-head>. Use the same axis ownership above. Receipt <receipt>, full suite
<full-suite>.

Read the whole current branch input required by that axis; do not rely on its prior receipt as a verdict.
Do not change tracked files, the index or HEAD. For each remaining owned finding, give file:line and the
concrete unmet spec clause or breaking input/state. Run focused checks needed for the verdict and the full
suite. Return `complete` only when no owned finding remains; otherwise return `blocked` with every finding.
Write the receipt and structured return under the shared contract, omitting commit and action fields.
```

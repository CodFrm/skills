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

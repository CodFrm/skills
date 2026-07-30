<!--
Template: docs/verification.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, delete any
section you do not need, and delete this comment block at the end.
This file owns "how to confirm a change really works / how to reproduce a bug" — driving the
real application with a one-off script.
It is not the test suite reference (that is testing.md), and not the e2e harness manual (that
is e2e/README.md).
-->

# Feature verification

> **What this file owns.** How to **confirm a change really works**, or **reproduce a reported bug** — by driving <the real application form> for end-to-end observation. Each scenario produces a `report.md`, the traceable record of that verification or reproduction. Deliberately kept light: a one-off script + evidence that stays local, **never entering git**.
>
> **What this file is not.** Not the test suite reference (that is [`testing.md`](./testing.md)), and not the operating manual for the e2e harness (that is [`../e2e/README.md`](../e2e/README.md)).

---

## When to skip this guide

This guide is **process routing**, not a blanket exemption from TDD. Use it only when the change needs a real runtime environment, a real external API or cross-process behaviour to be observable. Skip it outright for the following, where a typecheck + the relevant committed tests are enough:

- Pure documentation, pure comment or pure type changes — there is no runtime behaviour to observe.
- Pure logic already fully covered by targeted unit tests (parsers, utility functions, reducers) — **write/run that test rather than starting a real application for it**.
- Any change fully provable by committed tests without a real runtime environment.

When in doubt, the criterion is: **does this depend on cross-process wiring or a real external API that a unit test cannot cover?** If not → the targeted unit test is the whole verification, and do not invoke this guide's one-off script process just to "look thorough".

---

## The one rule: verification ≠ growing the smoke suite

The smoke e2e suite is **heavy** (<explain: building + starting the real application + minutes>). When you only want to **confirm a feature works**, do not pay that cost, and do not leave anything behind:

- ❌ **Never** run the whole smoke e2e suite to verify one thing. <!-- This constrains this guide's process; CI and release gates running the full suite are their own deliberate checks. -->
- ❌ **Never** add a day-to-day verification script to the committed smoke suite.
- ✅ Write a one-off script in `e2e/scratch/` (**already gitignored**), run it, and leave the evidence locally.

**Promoting** a scenario into the smoke suite is a **separate, deliberate decision** — only when it deserves permanent regression protection. That route is owned by [`../e2e/README.md`](../e2e/README.md), not by this guide.

**Reproducing a bug you intend to fix does not count as "day-to-day verification".** A scratch reproduction is the "confirm the bug exists" step from [`../AGENTS.md`](../AGENTS.md). It normally confirms the bug is real, but **it is not itself the required test** — before fixing, fix it into a committed failing test. Only when it falls under the "automation genuinely not feasible" exception in [`testing.md`](./testing.md#exceptions-to-tdd) **is** this scratch reproduction (its `report.md`, command output/logs/screenshots, observations) the required evidence.

Choose the reproduction method by what the bug depends on: pure logic/parser bugs → a failing unit test; dependence on a real runtime environment, an external API or cross-process behaviour → this guide's scratch process.

---

## Step 1 · Clear the cheap signals first (proportionate to risk, not mechanically running everything)

Driving the real application is the **last** check, not the first. Confirm the cheap signals are green before starting — but **choose them in proportion to the risk**, rather than mechanically running everything each time:

```bash
<typecheck command>                 # always run
<targeted unit test command>        # the tests relevant to this change — the default tier
<full unit test command>            # only for a wide change surface, touching shared code, or when the repository gate demands it
```

A typecheck + the relevant targeted tests are the **default** precondition, not "the full suite before every scratch verification". Escalate when the change's blast radius cannot be confirmed local (shared utilities, config, public interfaces).

**Green unit tests do not mean the feature works** — they only mean the units you asserted behave as expected. <Cross-process wiring / real external APIs> is only exercised at real runtime. That gap is exactly what this guide fills.

<!-- Keep when observability was done -->
> **Turn the log level up to `DEBUG` before starting** (<how>). The logs are the primary basis for "how far did it actually get" — especially when it cannot be reproduced, saying where it got to and which branch it did not enter is far more useful than "cannot reproduce". The commands are in [`observability.md`](./observability.md#common-investigation-commands).

---

## Step 2 · Build / start a drivable target

```bash
<build command>
<start command>
```

<Explain: which changes can hot-reload and which require a restart/rebuild>

---

## Step 3 · Write a one-off scratch script

Scratch scripts live in **`e2e/scratch/`** and reuse the existing harness, so there is almost no boilerplate:

```<language>
<a minimal usable scratch template — import the project harness, drive a real UI/API, assert,
 and leave evidence (a UI screenshot, or command output / API response / logs — chosen by what
 is being verified, see "Where the evidence goes")>
```

What the harness provides (fixtures, page/API openers, data seeding, mocks) is in [`../e2e/README.md`](../e2e/README.md).

### Running only your own scratch script

```bash
<command to run scratch only>
<command to filter a single scratch by name>
```

**Why two configurations**: the main configuration `testIgnore`s `scratch/`, so the smoke suite and CI **never** pick up a scratch script; the scratch configuration's `testDir` points at `e2e/scratch/`, so you can run them on demand at any time. The scratch files themselves are already gitignored.

### Where the evidence goes

All of one task's evidence goes in **`e2e/scratch/<task-name>/`**, one directory per verification scenario. `<task-name>` is a slug — lowercase, hyphenated, no spaces, because it is a directory name:

```
e2e/scratch/<task-name>/
├── report.md          # the human-readable verification report — start reading here
├── logs/              # command output and run logs
├── resources/         # input fixtures, exported files, captured payloads, before/after data snapshots
├── screenshots/       # UI only
└── videos/            # UI only, and only when sequencing cannot be described
```

**Which of these you actually produce follows what is being verified, rather than "there must be pictures"** — the table deciding that lives in [`references/verification-report-template.md`](./references/verification-report-template.md), alongside the rules for embedding each form. A `<this project's main form>` scenario directory usually holds only `report.md`, `logs/` and `resources/`; that is the right shape, not missing evidence.

The whole `e2e/scratch/` directory is gitignored, so these are **local evidence only, never committed**. **Do not** put verification screenshots/recordings/logs/notes into `docs/` or any committed directory unless you are deliberately adding a permanent documentation asset.

`resources/` holds any additional input or output needed to understand or re-run this run: consumed fixtures, mock responses, imported/exported files, generated output, temporary pages, before/after data snapshots. **Redact before saving, and redact again before embedding into the report.**

### Create `report.md` **before** running the browser / starting the application

Following the shape in [`references/verification-report-template.md`](./references/verification-report-template.md), create `e2e/scratch/<task-name>/report.md` **before starting**, then **fill it in as you go** — do not reconstruct it afterwards from memory.

**When wrapping up acceptance against a spec, `<task-name>` is the spec's own slug** — that is the whole naming rule, and it is what keeps a round's evidence in one directory instead of splitting it between the name the spec goes by and the name this run happened to be given. In that case the template's "acceptance evidence" section is mandatory: one subsection per acceptance criterion, carrying what a reader needs to reach the same verdict themselves. One missing subsection means one thing went unverified with nobody knowing. **The verdicts themselves go under "Verdict"**, one line per criterion — one list of verdicts, in one place, never restated as a second table beside the evidence.

---

## Step 4 · Report honestly

Verification only counts when **the observed result is reported as it was**.

- It works → state clearly **what you ran** and **what you observed** (that summary line, that screenshot, that assertion value, the report path).
- **For things the UI cannot drive, reach a verdict through observable side effects** — assert that **a specific structured log line appeared**, or what a database record became, rather than "no errors". "No errors" is not evidence.
- A failure, or a path that went unverified → **say so plainly**, with the raw output attached. **Do not soften it, and do not claim a success you did not see.**
- When **reproducing a bug** → state explicitly whether it reproduced. If it did, that failing observation (the error, the assertion difference, the error screenshot) **is** the evidence; normally it gets fixed into a committed failing test before the fix. If it did not → say what you tried, without implying the bug has gone away.
  - Two honest ways to write it; pick one and **state which** in the report: the scratch asserts the **expected** behaviour (the script stays red, showing the gap directly), or the scratch asserts the **current buggy** contract (the script is green, giving a reliably re-runnable record, annotated that it must flip once fixed). **Never describe red as green.**
- **Never weaken an assertion or skip a check to make a scratch run "pass".**

---

<!-- Keep when observability was done -->
## Using logs as evidence

Paste the few log lines that decide the conclusion into a code block in `report.md`, **not the whole log** — making the reader find a needle in a haystack is the same as giving no evidence.

```bash
<command that pulls out every log line for this one operation by correlation id>
```

**Redact before pasting into the report** (tokens, credentials, personal information). The full usage is in [`observability.md`](./observability.md#verifying-and-reproducing-with-observability-data).

## Maintaining this file

When the harness, the scripts or the paths change, bring this file in line with the branch's real state (see [`documentation.md`](./documentation.md)). A quick self-check:

```bash
<git ls-files to check the harness files still exist>
<git grep to check testIgnore in the main config still excludes scratch>
<git grep to check .gitignore still has e2e/scratch/>
```

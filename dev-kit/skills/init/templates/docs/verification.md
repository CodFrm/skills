<!--
Template: docs/verification.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, delete any
section you do not need, and delete this comment block at the end.
Owns "how to confirm a change really works / how to reproduce a bug" by driving the real
application with a one-off script. Not the test suite reference (testing.md), not the e2e
harness manual (e2e/README.md).
-->

# Feature verification

> **What this owns.** Confirming a change really works, or reproducing a reported bug, by driving <the real application form> end to end. Each scenario produces a `report.md` — a one-off script plus evidence that stays local and **never enters git**.
>
> Not the test suite reference ([`testing.md`](./testing.md)), and not the e2e harness manual ([`../e2e/README.md`](../e2e/README.md)).

## When to skip this guide

This is **process routing**, not an exemption from TDD. Use it only when the change needs a real runtime, a real external API or cross-process behaviour to be observable. Skip it for:

- Pure documentation, comment or type changes — no runtime behaviour to observe.
- Pure logic already covered by targeted unit tests (parsers, utilities, reducers) — **write and run that test rather than starting a real application**.
- Anything fully provable by committed tests without a real runtime.

The criterion: **does this depend on cross-process wiring or a real external API that a unit test cannot cover?** If not, the targeted unit test is the whole verification.

## The one rule: verification ≠ growing the smoke suite

The smoke e2e suite is **heavy** (<building + starting the real application + minutes>). To confirm one feature works:

- ❌ **Never** run the whole smoke suite to verify one thing.
- ❌ **Never** add a day-to-day verification script to the committed smoke suite.
- ✅ Write a one-off script in `e2e/scratch/` (**already gitignored**), run it, leave the evidence locally.

**Promotion** into the smoke suite is a **separate, deliberate decision**, owned by [`../e2e/README.md`](../e2e/README.md).

**Reproducing a bug you intend to fix is not "day-to-day verification".** A scratch reproduction is the "confirm the bug exists" step from [`../AGENTS.md`](../AGENTS.md); **it is not itself the required test** — fix it into a committed failing test before fixing the code. Only under the "automation genuinely not feasible" exception in [`testing.md`](./testing.md#exceptions-to-tdd) **is** the scratch reproduction the required evidence. Choose by what the bug depends on: pure logic → a failing unit test; a real runtime, external API or cross-process behaviour → this guide.

## Step 1 · Clear the cheap signals first

Driving the real application is the **last** check, not the first — but choose the earlier ones in proportion to risk rather than mechanically running everything:

```bash
<typecheck command>                 # always run
<targeted unit test command>        # the tests relevant to this change — the default tier
<full unit test command>            # only for a wide surface, shared code, or when the gate demands it
```

**Green unit tests do not mean the feature works** — <cross-process wiring / real external APIs> is only exercised at real runtime, and that gap is what this guide fills.

<!-- Keep when observability was done -->
> **Turn the log level up to `DEBUG` before starting** (<how>). When something cannot be reproduced, saying where it got to and which branch it did not enter beats "cannot reproduce". Commands in [`observability.md`](./observability.md#common-investigation-commands).

## Step 2 · Build / start a drivable target

```bash
<build command>
<start command>
```

<Which changes hot-reload and which require a restart or rebuild.>

## Step 3 · Write a one-off scratch script

Scratch scripts live in **`e2e/scratch/`** and reuse the existing harness:

```<language>
<a minimal usable scratch template — import the project harness, drive a real UI/API, assert,
 and leave evidence chosen by what is being verified>
```

What the harness provides (fixtures, page/API openers, data seeding, mocks) is in [`../e2e/README.md`](../e2e/README.md).

```bash
<command to run scratch only>
<command to filter a single scratch by name>
```

**Why two configurations**: the main one `testIgnore`s `scratch/`, so the smoke suite and CI **never** pick up a scratch script; the scratch configuration's `testDir` points at `e2e/scratch/`, so you can run them on demand.

### Where the evidence goes

One directory per verification scenario, `<task-name>` a lowercase hyphenated slug:

```
e2e/scratch/<task-name>/
├── report.md          # the human-readable report — start reading here
├── logs/              # command output and run logs
├── resources/         # fixtures, exported files, captured payloads, before/after snapshots
├── screenshots/       # UI only
└── videos/            # UI only, and only when sequencing cannot be described
```

**Which of these you produce follows what is being verified, not "there must be pictures"** — the deciding table is in [`references/verification-report-template.md`](./references/verification-report-template.md). A scenario directory holding only `report.md`, `logs/` and `resources/` is the right shape, not missing evidence.

The whole directory is gitignored: **local evidence only, never committed.** Do not put verification screenshots, recordings or logs into `docs/` or any committed directory. **Redact before saving, and again before embedding into the report.**

### Create `report.md` **before** running

Create it from [`references/verification-report-template.md`](./references/verification-report-template.md) **before starting**, then fill it in as you go rather than reconstructing it from memory.

**When wrapping up acceptance against a spec, `<task-name>` is the spec's own slug** — that is what keeps a round's evidence in one directory. There the template's acceptance-evidence section is mandatory: one subsection per acceptance criterion, carrying what a reader needs to reach the same verdict themselves. **The verdicts themselves go under "Verdict"**, one line per criterion, in one place, never restated as a second table beside the evidence.

## Step 4 · Report honestly

- It works → state **what you ran** and **what you observed**: the summary line, the screenshot, the assertion value, the report path.
- **For what the UI cannot drive, reach a verdict through observable side effects** — a specific structured log line appearing, or what a database record became. **"No errors" is not evidence.**
- A failure, or a path that went unverified → **say so plainly**, with the raw output. **Do not soften it, and do not claim a success you did not see.**
- **Reproducing a bug** → state explicitly whether it reproduced. Two honest ways to write it, and the report says which: the scratch asserts the **expected** behaviour (stays red, showing the gap), or it asserts the **current buggy** contract (green, annotated that it must flip once fixed). **Never describe red as green.**
- **Never weaken an assertion or skip a check to make a scratch run pass.**

<!-- Keep when observability was done -->
## Using logs as evidence

Paste the few lines that decide the conclusion into `report.md`, **not the whole log**.

```bash
<command that pulls out every log line for this one operation by correlation id>
```

**Redact before pasting.** Full usage in [`observability.md`](./observability.md#verifying-and-reproducing-with-observability-data).

## Maintaining this file

When the harness, scripts or paths change, bring this file in line with the branch (see [`documentation.md`](./documentation.md)):

```bash
<git ls-files to check the harness files still exist>
<git grep to check testIgnore in the main config still excludes scratch>
<git grep to check .gitignore still has e2e/scratch/>
```

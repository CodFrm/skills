<!--
Template: docs/references/verification-report-template.md
Usage: copy into the project's docs/references/ and delete this comment block. This file is
itself the template humans and agents copy from, and needs almost no editing.
-->

# Local verification report template

**Before** running the real application, create this record at `e2e/scratch/<task-name>/report.md` and **update it as you go**, rather than filling it in at the end from memory.

It exists so **a reader can judge whether the implementation is right**, which is why **evidence goes inline rather than linked out**: scrolling top to bottom should show the decisive output, log lines and pixels without opening a side file. A bare link is a fallback for what genuinely cannot be embedded (archives, binaries, huge logs), and it **must** say what is in it.

**Two uses, one shape:**

| Scenario | Required | Deletable |
| --- | --- | --- |
| Wrap-up acceptance against a spec | "Acceptance evidence" — one subsection per criterion | "Reproduction steps", "Minimal reproduction" |
| Ad-hoc investigation / reproducing a bug | "Reproduction steps", "Minimal reproduction", "Verdict" | "Acceptance evidence", "Persistent data changes" |

**One list of verdicts, in one place.** For wrap-up acceptance the "Verdict" section carries them — one line per acceptance criterion, each `passed` / `passed (mocked)` / `failed` / `not-run`, with how it was checked and the command a reader runs themselves. "Acceptance evidence" holds the **evidence** behind them; **do not restate the verdicts there** — two copies means one goes stale, and the stale one is always what nothing reads.

## Where the files go

One scenario, one directory. All paths are **relative to `report.md`**, and **the unit you hand to someone else is the whole directory** — zip it; sending `report.md` alone leaves broken links.

```text
e2e/scratch/<task-name>/
├── report.md          # this record — start reading here
├── logs/              # command output and run logs
├── resources/         # fixtures, exported files, captured payloads, before/after snapshots
├── screenshots/       # UI only
└── videos/            # UI only, and only when sequencing cannot be described
```

**A directory with no `screenshots/` is not missing evidence** — a CLI / API / background-job scenario normally holds only `report.md`, `logs/` and `resources/`.

## Choose the evidence form by what is being verified

Decisive evidence is **the smallest readable record that lets a reader re-check the conclusion**, not "is there a picture":

| What is verified | Decisive evidence |
| --- | --- |
| UI / interaction | Screenshots prove static state; add a short recording + key still frames for sequencing |
| CLI | Full command + exit code + the stdout/stderr lines that decide the conclusion |
| HTTP / RPC API | Request (method, path, payload) + status code + the key response fields |
| Background job / async / messaging | Structured logs with a correlation id + before-and-after data snapshots |
| Data / migration | Both directions' commands + exit codes **against a database holding real existing data**; the same query before and after, side by side |
| Pure logic / library | The test run record: command + exit code + assertion output |

## Use this shape

```md
# Local verification record: <scenario name>

## Mode

`verifying a change` | `reproducing a bug`

## Goal / problem

- (verifying a change) What behaviour should hold, and why it might not
- (reproducing a bug) **Expected:** … **Actual:** …

## Verdict

<one sentence to a short paragraph — whether it holds, the observation that decides it, and
what nobody observed; written last, per "Filling-in discipline" below>

- (reproducing a bug) whether the scratch asserts the **expected behaviour** (stays red) or the
  **current buggy contract** (green, and must flip once fixed) — state which
- (wrap-up acceptance) one line per acceptance criterion, and only here:

  | # | Criterion | Verdict | How | Check it yourself |
  | --- | --- | --- | --- | --- |
  | V1 | `<copied verbatim from the spec>` | passed | drove the real UI | `<command a reader runs>` |
  | V2 | `<…>` | not-run | the staging account was unavailable | - |

## Reproduction steps

1. …

## Minimal reproduction

- The smallest script/page/steps that trigger it (linking `resources/…`)

## Acceptance evidence

> Spec: `<the spec this round works from>`

### V1 · "<the criterion, verbatim>"

Check it yourself:

1. `<start command>` — brings the app up on `<url>`.
2. <the step that matters, and why this one rather than any page>
3. <what you should see>

| Before | After |
| --- | --- |
| ![before](screenshots/v1-before.png) | ![after](screenshots/v1-after.png) |

**Anything uncertain, unreached or half-run is `not-run` under "Verdict"**, with a note on what
was missing; **never write something unverified as passed**. Where a criterion did not hold, put
a two-column table (what the spec requires / what actually happens) here rather than a paragraph.

## Evidence index

Anything not tied to a single criterion — run logs, resources, environment captures — embedded
and annotated with what it proves. Subheadings follow the evidence you actually collected, so
"Screenshots" and "Recording" appear only for a UI change:

### Commands and output

```console
$ <command>   # cwd=repo root, <key env vars>
<the lines that decide the conclusion>
$ echo $?
0
```

<one sentence on what this proves>. Full output: [run.log](logs/run.log)

## Persistent data changes

| The change | Forward migration | Backward migration | Before/after | Verdict |
| --- | --- | --- | --- | --- |
| `<what changed, as announced to the user>` | `<command>` exit 0 | `<command>` exit 0 | [query](resources/a1.txt) | passed |

- **Which database it ran against**: where the fixture came from, how many existing rows, which
  edge values (NULL / empty / dirty). **Green on an empty database is not evidence.**
- **Where there is no down migration**: why it is irreversible, the substitute backup plan, and
  whether it was actually run.
- **The rolling-release window**: what old code does reading the new structure, and new code
  reading the old data. State explicitly when there is no rolling release.

## Task checklist

- [ ] The preconditions passed
- [ ] Built and started the real entry point (UI / CLI / API / worker)
- [ ] Drove to the target behaviour and confirmed a stable anchor
- [ ] Saved this run's decisive evidence, in the form chosen by what is being verified
- [ ] Wrote the conclusion, and the verdicts, under "Verdict"

## Execution record

| Step | Status | Evidence | Notes |
| --- | --- | --- | --- |
| <step> | pending | - | - |

## Blockers

- None
```

## Filling-in discipline

**"Verdict" sits near the top but gets filled in last** — reading order, not writing order: a reader should reach the conclusion within one screen, and it is an honest judgement made once the evidence is in. Three things it must answer:

1. **Whether it holds** — the behaviour holds, the bug reproduced, or where the round stands overall.
2. **What that rests on** — the one observation that decides it. A clause, not a section.
3. **What nobody observed** — every criterion that is not `passed`, named by its id, and what a reader accepts by shipping anyway. **Say so when there are none**, because "nothing written" and "nothing outstanding" read identically.

**Anything short of every criterion `passed` cannot be summarised as holding**: `not-run` says nobody looked, `failed` says someone looked and it did not hold, and neither is something a single word absorbs. The conclusion is **not** a second pass through the verdict table, and **not** the evidence — **one sentence to a short paragraph**, or it becomes a second report that gets skimmed past.

> **Seven of the eight criteria hold; V6 is not-run.** Returning to the initiating page and the 400 on an expired code were both seen in the real app. V6 needed a staging account this round could not get, so concurrent multi-device login was observed by nobody — that is what merging accepts.

In `verifying a change` mode delete "Reproduction steps" / "Minimal reproduction". In `reproducing a bug` mode keep them: a later reader should be able to **re-trigger the bug from `report.md` alone**, without reading the code. **"Persistent data changes" is kept only when this round touched persistent data**, and then carries one row per change.

**The checklist stays honest:** list the unchecked tasks from the start; tick a box only once the command or assertion **actually** passed; a blocked step stays unticked with a specific entry under "Blockers".

## Embedding rules

- **Commands and output** — the full command (with cwd and key environment variables), the exit code, and the deciding lines, in a `console` code block, **complete enough to copy and re-run**. Fold the rest into `<details>` rather than dropping it, with the summary saying how many lines and which file; `<details>`, `</details>` and `<summary>` each on their own line.
- **A list checked line by line** — a `- [x]` / `- [ ]` task list, with **the failing line left in, unticked**. Tidying it down to what passed turns a gap into a silence.
- **Expectation and reality disagreeing** — a two-column table (required / actual), not a paragraph.
- **APIs / data** — request + status + key response fields; for data, the same query before and after, side by side. Trim to what supports the verdict.
- **Screenshots** — `![caption](screenshots/….png)` plus **one sentence on what it proves**; pairs (before/after, light/dark) in a two-column table. **Only for a UI** — screenshotting a terminal is worse than pasting the text.
- **Recordings** — a `<video controls preload="metadata" width="720" poster="videos/….png">` wrapper with an explicit `<source … type="video/mp4">`, fallback text inside, and a plain relative link right after `</video>` (some renderers sanitize raw HTML). Store as **mp4 / h264**. No `autoplay`, no absolute paths, no base64. **Capture the decisive moments as stills during the run and put them next to it — the stills carry the verdict, not the recording.**
- **Logs** — paste the deciding lines, then link the full capture. A link alone forces the reader to reconstruct which line mattered.
- **Resources** — embed short text fixtures directly; link only large files or binaries, saying what is in them.
- **Redact before embedding** tokens, cookies and real credentials.

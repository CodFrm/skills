<!--
Template: docs/references/verification-report-template.md
Usage: copy into the project's docs/references/ and delete this comment block. This file is
itself the template humans and agents copy from, and needs almost no editing.
-->

# Local verification report template

**Before** running the real application, create this record in the scenario directory, e.g. `e2e/scratch/<task-name>/report.md`. **Update it as you go**, rather than filling it in at the end from memory.

This record exists so **a reader can judge whether the implementation is right**, which is why **evidence goes inline rather than linked out**: scrolling from top to bottom should show the decisive command output, log lines and pixels without opening any side file. A bare link is only a fallback, for things that genuinely cannot be embedded (archives, binaries, tens of megabytes of logs), and it **must** carry a line saying what is in it.

**Two uses, one shape:**

| Scenario | Required | Deletable |
| --- | --- | --- |
| Wrap-up acceptance against a spec | "Acceptance evidence" — one subsection per acceptance criterion, carrying what a reader needs to reach the same verdict | "Reproduction steps", "Minimal reproduction" |
| Ad-hoc investigation / reproducing a bug | "Reproduction steps", "Minimal reproduction", "Verdict" | "Acceptance evidence", "Persistent data changes" |

**One list of verdicts, in one place.** In the wrap-up acceptance case the "Verdict" section below carries them — one line per acceptance criterion this round was checked against (the criteria this round set for itself from the spec's requirements), each `passed` / `passed (mocked)` / `failed` / `not-run` (absent meaning not reached yet), with how it was checked and the command a reader runs themselves. "Acceptance evidence" is the **evidence** behind them, one subsection per criterion; **do not restate the verdicts there as a table** — two copies means one goes stale, and the stale one is always the copy nothing reads.

---

## Where the files go

One scenario, one directory. All paths in the report are **relative to `report.md`**, and **the unit you hand to someone else is the whole directory** — zip it and send that; sending `report.md` alone leaves a pile of broken links.

```text
e2e/scratch/<task-name>/
├── report.md          # this record — start reading here
├── logs/              # command output and run logs
├── resources/         # input fixtures, exported files, captured payloads, before/after data snapshots
├── screenshots/       # UI only
└── videos/            # UI only, and only when sequencing cannot be described
```

**A directory with no `screenshots/` is not missing evidence.** A CLI / API / background-job scenario normally holds only `report.md`, `logs/` and `resources/`, and that is the right shape.

---

## Choose the evidence form by what is being verified

Decisive evidence is **the smallest readable record that lets a reader re-check the conclusion**, not "is there a picture":

| What is verified | Decisive evidence |
| --- | --- |
| UI / interaction | Screenshots prove static state; add a short recording + key still frames for sequencing |
| CLI | Full command + exit code + the lines of stdout/stderr that decide the conclusion |
| HTTP / RPC API | Request (method, path, payload) + status code + the key fields of the response body |
| Background job / async / messaging | Structured logs with a correlation id + before-and-after data snapshots |
| Data / migration | Both directions' commands + exit codes, **against a database holding real existing data**; the same query before and after, side by side |
| Pure logic / library | The test run record: command + exit code + assertion output |

---

## What `## Evidence index` looks like (this is an **example**, not a second section to add)

Below is a filled-in example. The template proper has only one `## Evidence index` heading; fill it in following this shape. **Subheadings follow the evidence you actually collected** — "Screenshots" and "Recording" only appear for UI changes.

~~~md
## Evidence index

### Commands and output

```console
$ npm run e2e:scratch -- -g import   # cwd=repo root, E2E_BASE_URL=http://127.0.0.1:5199
[verify] item count after import = 3
1 passed (4.2s)
$ echo $?
0
```

The import command ran and the item count matches — proving the import path works end to end. Full output: [run.log](logs/run.log)

### Screenshots

![list page](screenshots/list.png)
The list rendered and the view toggle is visible — proving the `/` route mounted.

| Light | Dark |
| --- | --- |
| ![settings light](screenshots/settings-light.png) | ![settings dark](screenshots/settings-dark.png) |

The settings page renders correctly and readably under both themes — proving it picked up the theme tokens rather than falling back to a single colour scheme.

### Recording

<video src="videos/run.mp4" poster="videos/run-poster.png" controls preload="metadata" width="720"></video>

The complete recording from the list page to the settings page; watch it to confirm the navigation process and the final stable state.

The decisive moments from the same run (a recording can neither be skimmed nor played by every viewer):

![before navigation](screenshots/nav-01-list.png)
The list page before the click, with the settings entry point available.

![after navigation](screenshots/nav-02-settings.png)
The settings page after the click, with the route switched and the content painted.

### Logs

The lines the conclusion rests on:

```text
[verify] current URL = <...>
[verify] item count after import = 3
```

Full capture: [console.log](logs/console.log) — no unexpected errors appeared during the run.

### Resources

`resources/import.yaml` — the input this import verification consumed:

```yaml
items:
  - name: demo
    source: <...>
```
~~~

---

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

- (reproducing a bug) whether the scratch asserts the **expected behaviour** (stays red) or the **current buggy contract** (green, and must flip once fixed) — state which
- (wrap-up acceptance) one line per acceptance criterion, and only here:

  | # | Criterion | Verdict | How | Check it yourself |
  | --- | --- | --- | --- | --- |
  | V1 | `<copied verbatim from the spec>` | passed | drove the real UI | `<command a reader runs>` |
  | V2 | `<…>` | not-run | the staging account was unavailable | - |

## Reproduction steps

1. …
2. …

## Minimal reproduction

- The smallest script/page/steps that trigger it (linking `resources/…`)

## Acceptance evidence

> Spec: `<the spec / requirement document this round works from>`

### V1 · "clicking sign in returns to the page that initiated it"

Check it yourself:

1. `<start command>` — brings the app up on `<url>`.
2. Open `<url>/settings`, any page other than the home page: the point is returning to *this* one.
3. Click sign in and authorise. You land back on `/settings`, signed in.

| Before | After |
| --- | --- |
| ![signed out](screenshots/v1-before.png) | ![signed in](screenshots/v1-after.png) |

### V2 · "an expired code returns 400 and creates no session"

The command, its exit code and the lines the conclusion rests on, with the rest folded away — see the embedding rules below.

**Anything uncertain, unreached or half-run is `not-run` under "Verdict"**, with a note on what was missing; **never write something unverified as passed**. Where a criterion did not hold, put a two-column table (what the spec requires / what actually happens) here rather than narrating the difference in a paragraph.

## Evidence index

Anything that is not tied to a single acceptance criterion — run logs, resources, environment captures — embedded and annotated with what it proves; see the shape example above.

## Persistent data changes

| The change | Forward migration | Backward migration | Before/after comparison | Verdict |
| --- | --- | --- | --- | --- |
| `<what changed, as it was announced to the user>` | `<command>` exit 0 | `<command>` exit 0 | [before/after query](resources/a1-before-after.txt) | passed |

- **Which database it ran against**: where the fixture came from, how many existing rows, which edge values it covers (NULL / empty string / dirty values). **Green produced on an empty database is not evidence.**
- **Where there is no down migration**: why it is irreversible, the substitute backup/export plan, and whether it was actually run.
- **The rolling-release window**: what the old code does reading the new structure, and the new code reading the old data. State explicitly when there is no rolling release.

## Task checklist

- [ ] The preconditions passed
- [ ] Built and started the real entry point (UI / CLI / API / worker)
- [ ] Drove to the target behaviour and confirmed a stable anchor (rendering complete for UI, process exit for a CLI, the response returned for an API)
- [ ] Saved this run's decisive evidence, in the form chosen by what is being verified
- [ ] Wrote the conclusion, and the verdicts, under "Verdict"

## Execution record

| Step | Status | Evidence | Notes |
| --- | --- | --- | --- |
| <open the settings page> | pending | - | - |

## Blockers

- None
```

---

## Filling-in discipline

**"Verdict" sits near the top but gets filled in last** — reading order, not writing order. It is near the top because a reader should reach the conclusion within one screen; it is written last because it is an honest judgement made once the evidence is in, per "Report honestly" in [`../verification.md`](../verification.md). The execution record's status moves from `pending` towards `pass` / `fail` / `blocked`.

**That section opens with the conclusion in prose, and that paragraph is the whole of it** — there is no one-word verdict field beside it, because a word and a paragraph making the same claim are one truth in two places, and the stale copy is always the one nothing reads. Three things it has to answer, and it is unfinished while any of them is missing:

1. **Whether it holds** — does the behaviour hold (`verifying a change`), did it reproduce (`reproducing a bug`), where the round stands overall (wrap-up acceptance).
2. **What that rests on** — the one observation that decides it: that summary line, that assertion value, that screenshot. A clause, not a section.
3. **What nobody observed** — every criterion that is not `passed`, named by its id, and what a reader accepts by shipping anyway. **Say so when there are none**, because "nothing written" and "nothing outstanding" read identically.

**Anything short of every criterion `passed` cannot be summarised as holding.** One `not-run` or one `failed` is enough that the conclusion has to name it: `not-run` says nobody looked, `failed` says someone looked and it did not hold, and neither is something a single word absorbs.

**Two things the conclusion is not.** Not a second pass through the verdict table — those verdicts live there and only there, and a list of them here is the copy that goes stale. Not the evidence either, which is what "Acceptance evidence" and "Evidence index" carry. **One sentence to a short paragraph**: longer and it is a second report, which gets skimmed past the two lines that mattered.

> **Seven of the eight criteria hold; V6 is not-run.** Returning to the initiating page and the 400 on an expired code were both seen in the real app. V6 needed a staging account this round could not get, so concurrent multi-device login was observed by nobody — that is what merging accepts.

In `verifying a change` mode, delete the "Reproduction steps" / "Minimal reproduction" sections. In `reproducing a bug` mode, fill in expected/actual and keep those two sections — a later reader or AI should be able to **understand and re-trigger this bug from `report.md` alone**, without reading the code.

**"Persistent data changes" is kept only when this round touched persistent data** — a schema migration, a backfill, a deletion — and then it carries one row per change with none omitted. Delete the whole section when nothing persistent was touched.

**The checklist stays honest:**

- List the unchecked tasks from the start, describing what you intend to verify.
- Tick a box only once the corresponding command/assertion **actually** passed.
- A step got blocked → leave it unticked, and write a specific entry under "Blockers": what failed, where, and what evidence was captured.

**Embedding rules** (pick the form from the table above first, then embed like this):

- **Commands and output** — the full command (marking cwd and key environment variables where needed), the exit code, and the lines of stdout/stderr that decide the conclusion, pasted into a code block (tagged `console`). **Complete enough that a reader can copy it and re-run.** Fold the rest into `<details>` rather than dropping it, with the summary saying how many lines it is and which file it came from; `<details>` and `</details>` each go on their own line and `<summary>` on one line, and whatever sits between them renders as ordinary markdown.
- **A list checked line by line** — a `- [x]` / `- [ ]` task list, with **the failing line left in the list, unticked**. Tidying it down to the things that passed turns a gap into a silence.
- **Expectation and reality disagreeing** — a two-column table (what was required / what actually happens), not a paragraph describing the difference.
- **APIs / data** — the request (method, path, payload) + status code + the response body's key fields; for data, put two results of the same query before and after side by side. Trim to what supports the verdict; do not paste a whole dump.
- **Screenshots** — `![caption](screenshots/….png)` plus **one sentence on what it proves**. Put pairs (before/after, light/dark) in a two-column table so the comparison takes one glance rather than two screens. **Only when there is a UI** — screenshotting a terminal is worse than pasting the text (unsearchable, undiffable, and likely to drag in the neighbouring window).
- **Recordings** — `<video src="videos/….mp4" poster="videos/….png" controls preload="metadata" width="720"></video>`, in **mp4 / h264** so it plays everywhere without anyone checking a browser version. `controls` is required (without it the recording is a picture nobody can operate), `poster` gives it a frame before anything is fetched, and `preload="metadata"` stops a large file being pulled the moment the page opens. A recording is hard to skim in any case, so **capture the decisive moments as stills during the run** and put them next to it. **The stills are what carry the verdict, not the recording.**
- **Logs** — paste the lines the conclusion rests on into a code block, then link the full capture. Giving only a link forces the reader to reconstruct which line mattered.
- **Resources** — embed short text fixtures (YAML/JSON/scripts) directly into a code block. Leave a link only for large files or binaries, saying what is in it.
- **Redact before embedding** tokens, cookies and real credentials — embedding puts it in front of every reader.

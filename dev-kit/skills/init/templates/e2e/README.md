<!--
Template: e2e/README.md
Usage: copy into the project's e2e/, replace <angle brackets> with real content, and delete this
comment block at the end.
This file owns the e2e harness's operating manual: how the two tracks divide the work, how to
run them, how to write them, and the hermetic guarantees.
"When verification should happen and how the report is written" lives in docs/verification.md —
link there rather than copying it.

Note: the link below pointing at `../.env.example` does not resolve inside the template
directory (the template file is named `env.example`, with no leading dot, to stop it becoming a
hidden file in the template directory). Once copied into the project, with
`templates/env.example` landed as `<project root>/.env.example`, the link is correct.
-->

# E2E

End-to-end tests driving a **really running <project name>** with <the driver>. **Two tracks, different purposes, different destinations, never mixed.**

## 1. The two tracks — choose the right one first

| | **Smoke e2e (committed)** | **Local verification e2e (not committed)** |
|---|---|---|
| Location | `e2e/<smoke directory>/*.spec.<ext>` (committed) | `e2e/scratch/` (**gitignored**) |
| How to run | `<smoke command>` | `<scratch command>` |
| Lifetime | A permanent regression guardrail | One-off — write it, run it, observe, throw it away |
| External dependencies | **All mocked**, never touching a real environment | May reach a real environment (via `.env`) |
| What goes in | **Core / high-value flows only** | "I just finished X — does it actually work in the real application?" |
| Output | A green light in CI | `e2e/scratch/<task-name>/report.md` |
| Audience | Everyone, every time the suite runs | You / an AI, right now |

**The bar for a committed spec is high.** One e2e is slow (<state the cost: building + starting the real application, minutes>) and a long-term maintenance liability. **Only core flows** earn a commit: the application starts, main navigation, CRUD on the main entities, one critical data-integrity path. Everything else goes to the local verification track and **the script gets thrown away**.

**When in doubt, use the local verification track.** **Promoting** a scenario into the smoke suite is a **separate, deliberate decision** — only when the flow is unambiguously core and already stable.

**Most feature verification is the second track.** After finishing a feature, the right move is usually: write a scratch script → run it against the real application → read the assertions + <the independent oracle> + the logs → confirm it works → write it into the report → throw the script away.

## 2. Architecture

```
<smoke command>  →  <orchestration script> (brings processes up, cleans up afterwards)
  └─ <test runner> (workers: 1)
       ├─ <the application under test>   ← the real backend / front end
       ├─ <protocol mock 1>:<port>       ← standing in for a real external dependency
       └─ <the driver> → <address>
             └─ the spec asserts the UI / API …
                  … and cross-checks with <the independent oracle: querying the database / the logs>
```

The application starts with these environment overrides:

| Environment variable | Effect |
|---|---|
| `<data directory override>` | Data, config and logs all land in a throwaway temporary directory |
| `<credential/keychain override>` | **Bypasses the system keychain** — neither reads nor writes the real credential store |
| `<e2e marker>` | Skips the single-instance lock, coexisting with a running development instance |
| `<optional: disable slow initialisation>` | Skips slow startup steps irrelevant to what is under test |

**Port `<port>` is dedicated**, neither reused nor colliding with the development instance's default port.

## 3. Isolation and safety guarantees

A run is fully hermetic, and **a running development instance does not interfere with it**:

- **Data** — all under `<temporary directory>`, deleted by <the orchestration script> afterwards. **The real user data directory is never touched.**
- **Credentials** — an explicit `<key environment variable>` short-circuits keychain access; the system credential store is neither read nor written.
- **Ports** — a dedicated port, not conflicting with the development instance.
- **The startup assertion** — one spec in the smoke suite asserts <a characteristic identifying the application under test, e.g. the page title>, so **if another process happens to hold the port, the suite fails loudly rather than going falsely green**.
- **The single-instance lock** — skipped by `<e2e marker>`.

The one genuine caveat: **run only one e2e instance locally at a time** (the temporary directory path is fixed). CI runners are isolated from one another and independent.

## 4. Running the smoke suite

```bash
<one-off command to install dependencies / browsers>   # needed once
<smoke command>
```

Prerequisites: <list: runtime versions, CLI tools>. The first run builds (a few minutes) <and: a native window will appear — this is expected>.

The current suite (`e2e/<smoke directory>/`): <list what each spec covers>.

## 5. Protocol mocks — the reusable shape for "it really can connect" tests

Smoke e2e **never touches a real external environment**. When you need to verify "the application really can connect to some external service", stand up a **tiny protocol mock**:

- A zero-dependency single file, in `e2e/fixtures/`.
- Started as a **second managed process**, listening on a dedicated port.
- **The port is passed to the spec through an environment variable**, not hard-coded in the spec.
- It implements only the few responses the client handshake genuinely needs — not a full server implementation.

```<language>
<the skeleton of a minimal mock: listen on the port, answer the handshake, generic response for everything else>
```

<!-- Keep this section when there are AI / LLM calls -->
### Programmable fake models

AI-related specs run the **real** AI call chain against `e2e/fixtures/<mock file>`. It implements just enough protocol + a control endpoint, with **the spec deciding what the "model" does — no behaviour hard-coded in the mock**:

```<language>
<a usage example such as scriptModel([...])>
```

## 6. Writing a scratch script (local verification)

See [`../docs/verification.md`](../docs/verification.md) for the full process and the report rules. The key points:

1. Write it in `e2e/scratch/` (gitignored), reusing this harness's fixtures and <the independent oracle>.
2. Run it with `<scratch command>` — which uses the **same** hermetic harness as the smoke suite.
3. Observe: the assertions + <the independent oracle> + the application logs.
4. **Write the verdict into `e2e/scratch/<task-name>/report.md`**, with the evidence embedded.
5. Throw the script away.

**Why the smoke suite can never pick up scratch**: <the main config file> sets `<the option excluding scratch>`, while <the scratch config file>'s test directory points at `e2e/scratch/`. **That is a mechanical guarantee, not good intentions** — gitignore alone is not enough.

### Verifying against a real environment

<!-- Keep when there are real external dependencies -->

The local verification track may hit a real target. Addresses and credentials go in `.env` (**gitignored**); the template is [`../.env.example`](../.env.example).

- **The application itself does not read `.env`** — only the e2e harness loads it into the environment during a test run (skipping it when the file is absent).
- **A real target = real side effects (not hermetic). Run only read-only / non-destructive operations, and clean up afterwards.**
- **The smoke suite never uses it.** The smoke track must be entirely mocked, or CI goes red because of someone else's environment.

## 7. Cleanup and investigating failures

After the test runner exits, <the orchestration script> is responsible for: reaping leftover processes, deleting the temporary data directory, and **deleting the log only on success, keeping it on failure**.

When a run fails, look first at:

```bash
<log path / viewing command>
<failure artefact paths: traces, screenshots>
```

## 8. Related documents

- When verification should happen and how the report is written → [`../docs/verification.md`](../docs/verification.md)
- How unit tests are designed, what to write and what not to → [`../docs/testing.md`](../docs/testing.md)
- Engineering principles → [`../AGENTS.md`](../AGENTS.md)

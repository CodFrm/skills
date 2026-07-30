<!--
Template: e2e/README.md
Usage: copy into the project's e2e/, replace <angle brackets> with real content, and delete this
comment block at the end.
Owns the e2e harness's operating manual: how the two tracks divide the work, how to run them,
how to write them, the hermetic guarantees. "When verification should happen and how the report
is written" lives in docs/verification.md — link there rather than copying it.

Note: the link to `../.env.example` does not resolve inside the template directory (the template
is named `env.example`, with no leading dot, to stop it becoming hidden). It is correct once
landed in the project.
-->

# E2E

End-to-end tests driving a **really running <project name>** with <the driver>. **Two tracks, different purposes, different destinations, never mixed.**

## 1. The two tracks — choose the right one first

| | **Smoke e2e (committed)** | **Local verification e2e (not committed)** |
|---|---|---|
| Location | `e2e/<smoke directory>/*.spec.<ext>` | `e2e/scratch/` (**gitignored**) |
| How to run | `<smoke command>` | `<scratch command>` |
| Lifetime | A permanent regression guardrail | One-off — write it, run it, observe, throw it away |
| External dependencies | **All mocked** | May reach a real environment (via `.env`) |
| What goes in | **Core / high-value flows only** | "I just finished X — does it actually work?" |
| Output | A green light in CI | `e2e/scratch/<task-name>/report.md` |
| Audience | Everyone, every run | You / an AI, right now |

**The bar for a committed spec is high** — one e2e is slow (<building + starting the real application, minutes>) and a long-term maintenance liability. **Only core flows** earn a commit: the application starts, main navigation, CRUD on the main entities, one critical data-integrity path. **When in doubt use the local verification track**, and treat promotion into the smoke suite as a **separate, deliberate decision**.

**Most feature verification is the second track**: write a scratch script → run it against the real application → read the assertions + <the independent oracle> + the logs → write the verdict into the report → throw the script away.

## 2. Architecture

```
<smoke command>  →  <orchestration script> (brings processes up, cleans up afterwards)
  └─ <test runner> (workers: 1)
       ├─ <the application under test>   ← the real backend / front end
       ├─ <protocol mock 1>:<port>       ← standing in for a real external dependency
       └─ <the driver> → <address>
             └─ the spec asserts the UI / API …
                  … and cross-checks with <the independent oracle>
```

The application starts with these environment overrides:

| Environment variable | Effect |
|---|---|
| `<data directory override>` | Data, config and logs land in a throwaway temporary directory |
| `<credential/keychain override>` | **Bypasses the system keychain** — the real credential store is neither read nor written |
| `<e2e marker>` | Skips the single-instance lock, coexisting with a running development instance |
| `<optional: disable slow initialisation>` | Skips slow startup steps irrelevant to what is under test |

**Port `<port>` is dedicated**, not colliding with the development instance.

## 3. Isolation and safety guarantees

- **Data** — all under `<temporary directory>`, deleted by <the orchestration script>. **The real user data directory is never touched.**
- **Credentials** — `<key environment variable>` short-circuits keychain access.
- **Ports** — dedicated, no conflict with the development instance.
- **The startup assertion** — one smoke spec asserts <a characteristic identifying the application under test>, so **if another process holds the port the suite fails loudly rather than going falsely green**.
- **The single-instance lock** — skipped by `<e2e marker>`.

The one genuine caveat: **run only one e2e instance locally at a time** (the temporary directory path is fixed). CI runners are independent.

## 4. Running the smoke suite

```bash
<one-off command to install dependencies / browsers>   # needed once
<smoke command>
```

Prerequisites: <runtime versions, CLI tools>. The first run builds (a few minutes) <and a native window will appear — expected>.

The current suite (`e2e/<smoke directory>/`): <what each spec covers>.

## 5. Protocol mocks — the reusable shape for "it really can connect" tests

Smoke e2e **never touches a real external environment**. To verify the application really can connect to some external service, stand up a **tiny protocol mock**:

- A zero-dependency single file in `e2e/fixtures/`.
- Started as a **second managed process** on a dedicated port.
- **The port reaches the spec through an environment variable**, never hard-coded.
- It implements only the few responses the client handshake needs.

```<language>
<the skeleton of a minimal mock: listen, answer the handshake, generic response for the rest>
```

<!-- Keep this section when there are AI / LLM calls -->
### Programmable fake models

AI specs run the **real** call chain against `e2e/fixtures/<mock file>`, which implements just enough protocol plus a control endpoint — **the spec decides what the "model" does; no behaviour is hard-coded in the mock**:

```<language>
<a usage example such as scriptModel([...])>
```

## 6. Writing a scratch script (local verification)

Full process and report rules in [`../docs/verification.md`](../docs/verification.md). The key points:

1. Write it in `e2e/scratch/` (gitignored), reusing this harness's fixtures and <the independent oracle>.
2. Run it with `<scratch command>` — the **same** hermetic harness as the smoke suite.
3. Observe the assertions + <the independent oracle> + the application logs.
4. **Write the verdict into `e2e/scratch/<task-name>/report.md`**, evidence embedded.
5. Throw the script away.

**Why the smoke suite can never pick up scratch**: <the main config> sets `<the option excluding scratch>`, while <the scratch config>'s test directory points at `e2e/scratch/`. **A mechanical guarantee, not good intentions** — gitignore alone is not enough.

### Verifying against a real environment

<!-- Keep when there are real external dependencies -->

Addresses and credentials go in `.env` (**gitignored**); the template is [`../.env.example`](../.env.example).

- **The application itself does not read `.env`** — only the e2e harness loads it during a run.
- **A real target means real side effects. Run only read-only / non-destructive operations, and clean up.**
- **The smoke suite never uses it**, or CI goes red because of someone else's environment.

## 7. Cleanup and investigating failures

After the runner exits, <the orchestration script> reaps leftover processes, deletes the temporary data directory, and **deletes the log only on success, keeping it on failure**.

```bash
<log path / viewing command>
<failure artefact paths: traces, screenshots>
```

## 8. Related documents

- When verification should happen and how the report is written → [`../docs/verification.md`](../docs/verification.md)
- How unit tests are designed → [`../docs/testing.md`](../docs/testing.md)
- Engineering principles → [`../AGENTS.md`](../AGENTS.md)

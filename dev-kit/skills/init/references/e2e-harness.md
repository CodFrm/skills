# How to build the E2E harness

> The **division of labour and the bar for entry** of the twin tracks belong to `SKILL.md` step 5 and `templates/e2e/README.md`. This file is **how to build it**.
>
> **The worked examples are Playwright / Node**, because they show each shape in the fewest lines. Every section states the ecosystem-neutral rule first — **carry the rule across and build the equivalent out of what the project already has**. Adding a Node toolchain to a repository that has none, purely to own its e2e, buys a second dependency tree for the sake of copying an example verbatim.

## 1. The twin tracks' mechanical guarantee — two configurations

**`.gitignore` alone is not enough**: it keeps scratch out of the repository but cannot guarantee CI will not pick it up, or that it stays runnable locally. That takes two configurations — the main one **excluding** the scratch directory, the scratch one **pointing only** at it — with both statements in configuration rather than in someone remembering `--grep`.

```ts
// playwright.config.ts — the smoke suite and CI
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/scratch/**"],   // ← the key: CI can never pick up scratch
  workers: 1,
  webServer: [ /* the real application + each protocol mock */ ],
});

// playwright.scratch.config.ts — the local verification track
export default defineConfig({ ...base, testDir: "./e2e/scratch", testIgnore: [] });
```

`.gitignore` gets this at the same time:

```gitignore
# One-off local verification scripts and evidence (see docs/verification.md); not committed, not in CI
e2e/scratch/
```

## 2. The hermetic checklist

A smoke run must be self-sufficient **and unaffected by a development instance on the same machine**. Implement each item and write it into `e2e/README.md`:

| Item | How | What happens without it |
|---|---|---|
| **Data** | Point the data directory/database/config at a temporary directory, deleted after the run | Pollutes the developer's real data |
| **Credentials** | Short-circuit the system keychain with an explicit test key | A system dialog blocks CI; the real keychain gets dirtied |
| **socket / lock files** | Derive them from the overridden data directory | Collides with a real instance |
| **Single-instance lock** | Skip it with an e2e marker | e2e cannot start while a development instance is open |
| **Ports** | A **dedicated port**, not the framework default | Collides with the development instance or another project's e2e |
| **Startup assertion** | Assert a characteristic identifying the application under test (title / version endpoint) | **A false green when another process holds the port** |
| **Slow optional initialisation** | Skip what is irrelevant, behind a switch | Tens of seconds wasted every run |

The startup assertion is the easiest to overlook and **the only defence against a false green** — without it, a suite whose port is taken connects to an unrelated service and "passes".

## 3. Protocol mocks — the shape for "it really can connect" tests

The smoke track **never touches a real external environment**. Four hard requirements for the mock:

1. **A zero-dependency single file** in `e2e/fixtures/`, written with what the runtime already provides.
2. **Started as a separate process**, managed by the test framework, with a port readiness probe.
3. **The port reaches the spec through an environment variable**, never hard-coded.
4. **It implements only the few responses the client handshake needs**, not a full server.

```js
// e2e/fixtures/redis-mock.mjs — answers only what the connection handshake needs
import net from "node:net";
const server = net.createServer((sock) => {
  sock.on("data", (buf) => {
    const cmd = buf.toString().toUpperCase();
    if (cmd.includes("HELLO")) sock.write("-ERR unknown command\r\n"); // triggers the RESP2 fallback
    else if (cmd.includes("PING")) sock.write("+PONG\r\n");
    else sock.write("+OK\r\n");
  });
});
server.listen(Number(process.env.MOCK_REDIS_PORT ?? 34217));
```

For a real handshake (SSH, TLS), stand up a minimal server with the language's standard library and have it **echo back what it received**, so the spec can assert the server really received the command shown in the UI rather than merely that nothing errored.

**Programmable fake models (AI / LLM):** run the **real** call chain against a mock implementing just enough protocol plus a control endpoint, with **the spec deciding what the "model" does** — otherwise the mock grows into a pile of if-else as the specs multiply.

```ts
await scriptModel([{ tool: { name: "exec", args: { command: "uptime" } } }, { text: "done" }]);
```

## 4. An independent oracle — do not trust the UI alone

Besides asserting the UI, **query the data source directly**, or the interface can say success while nothing was written.

```ts
await createAssetViaUI(page, { name: "e2e-host" });
const rows = readDb(dbPath, "SELECT name FROM assets WHERE deleted_at IS NULL");  // opened read-only
expect(rows.map(r => r.name)).toContain("e2e-host");
```

With no database, apply the same idea: read structured logs and assert a line, call a read-only endpoint, read an output file. **The point is that the assertion path does not share a source with the UI's.**

## 5. The orchestration script (not shell)

Write it in **a real language the project already builds with**, with `make` or a package-manager script as a thin forwarding layer — because **Windows has no `pkill` / `mkdir -p`**, and **cleanup logic needs real conditionals**. The responsibilities, not the syntax, are what transfers:

```js
// the skeleton of e2e/run-e2e.mjs
const tmpDir = mkdtempSync(join(tmpdir(), "<project>-e2e-"));
let code = 1;
try {
  code = await runPlaywright({ env: { DATA_DIR: tmpDir, /* … */ } });
} finally {
  reapOrphans();                                       // leftover build / dev-server processes
  rmSync(tmpDir, { recursive: true, force: true });
  if (code === 0) rmSync(logPath, { force: true });    // ← delete the log only on success
}
process.exit(code);
```

**"Delete the log only on success, keep it on failure" gets written in** — deleting it along with everything else on failure is the easiest and most painful mistake here.

## 6. Real-hardware verification goes through `.env`

Only the **local verification track** may hit a real environment:

1. **The application itself does not read `.env`** — only the harness loads it during a run, **skipping it when absent**.
2. **`.env` is gitignored, `.env.example` is committed.**
3. **A real target means real side effects. Read-only / non-destructive operations only, and clean up.**
4. **The smoke suite never uses it.**

`.env.example` (template in `templates/env.example`): the four rules in the header comment; **one `KEY=value` per line with no inline comments**, so `cp .env.example .env` parses trivially; one block per service, **deleting any block you do not need**; each service's traps beside it (e.g. an absolute private key path, since `~` is not expanded).

```ts
// e2e/playwright.config.ts
if (existsSync(".env")) {                      // ← skipped when absent
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) process.env[m[1]] ??= m[2];         // existing environment variables win
  }
}
```

## 7. Evidence directory layout

```
e2e/scratch/<task-name>/
├── report.md          # the human-readable report — start reading here
├── logs/              # command output and run logs
├── resources/         # fixtures, exported files, captured payloads, before/after snapshots
├── screenshots/       # UI only
└── videos/            # UI only, and only when sequencing cannot be described
```

**The form of evidence follows the runtime form in section 8.** A CLI or server API scenario usually holds only `report.md`, `logs/` and `resources/` — the verdict rests on command + exit code + the deciding lines, not on pictures.

Recording is enabled explicitly rather than by default, since it slows every run; one run may produce several files, and **they all stay under the same `videos/`**:

```bash
E2E_RECORD_VIDEO_DIR=e2e/scratch/<task-name>/videos <scratch command> -g "<test name>"
```

The report's own rules are in `templates/docs/references/verification-report-template.md`.

## 8. Choose the driver by runtime form

| Form | Driver | Its particular traps |
|---|---|---|
| Web application | Playwright / Cypress | Be explicit about a real versus mock backend; authentication state must be plantable |
| Browser extension | Playwright + `--load-extension` | Optional permissions granted up front (often a two-phase launch); permission dialogs auto-approved; background changes need an extension reload |
| Desktop (Wails/Tauri) | The browser bridge dev mode exposes + Playwright | A native window appears (expected); skip the single-instance lock; dedicated port |
| Desktop (Electron) | Playwright's Electron support | Main process and renderer are driven separately |
| CLI | Run the binary and assert stdout / exit code / output files | The simplest — prefer it; a pty for an interactive CLI |
| Server API | Start the real service + an HTTP client | Data seeding and cleanup must be idempotent |

**If a cheaper form can verify it, do not use an expensive one** — no browser for behaviour observable through a CLI or an API.

## 9. What belongs in the smoke suite

At initialisation, stand up these and **no more**:

1. **The application starts** — asserting a characteristic that identifies it.
2. **Main navigation** — every main area reachable and rendering.
3. **One core CRUD path** — create → visible → **confirmed persisted via the independent oracle** → delete.
4. **One critical data-integrity path** — the one the project can least afford to break.

Every later addition passes both halves of the bar: **is it a core flow, and is it stable?**

# How to build the E2E harness

> The **division of labour and the bar for entry** of the twin tracks are owned by `SKILL.md` step 5 and `templates/e2e/README.md`. This file is the concrete practice of **how to build it**.
>
> **The worked examples are Playwright / Node**, because they show each shape in the fewest lines. Every section states the ecosystem-neutral rule first and then illustrates it — **carry the rule across and build the equivalent out of what the project already has** (pytest + Playwright's Python binding, `go test` driving a real binary, whatever the repository already runs). Adding a Node toolchain to a repository that has none, purely to own its e2e, buys a second dependency tree for the sake of copying an example verbatim.

---

## 1. The twin tracks' mechanical guarantee — two configurations

**`.gitignore` alone is not enough.** It guarantees scratch is not committed, but it cannot guarantee "CI will not pick it up" or "it can be run locally at any time". That takes two configurations:

```ts
// playwright.config.ts — for the smoke suite and CI
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/scratch/**"],   // ← the key: CI can never pick up scratch
  workers: 1,
  webServer: [ /* the real application + each protocol mock */ ],
});
```

```ts
// playwright.scratch.config.ts — for the local verification track
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./e2e/scratch",        // ← runs scratch only
  testIgnore: [],
});
```

Other test frameworks work the same way: the main configuration **excludes** the scratch directory and the scratch configuration **points only** at it. The crux is that both statements live in configuration rather than relying on someone remembering to add `--grep`.

`.gitignore` gets this at the same time:

```gitignore
# One-off local verification scripts and evidence (see docs/verification.md); not committed, not in CI
e2e/scratch/
```

---

## 2. The hermetic checklist

A smoke run must be entirely self-sufficient, **and unaffected by a development instance running on the machine**. Implement each item and write it into `e2e/README.md`:

| Item | How | What happens without it |
|---|---|---|
| **Data** | Point the data directory/database/config at a temporary directory, deleted after the run | Pollutes the developer's real data |
| **Credentials** | Short-circuit the system keychain / credential store with an explicit test key | A system authorisation dialog blocks CI; the real keychain gets dirtied |
| **socket / lock files** | Derive them from the overridden data directory | Collides with a real instance over "an instance is already listening" |
| **Single-instance lock** | Skip it with an e2e marker | e2e cannot start while a development instance is open |
| **Ports** | A **dedicated port**, not reusing the framework default | Collides with the development instance or another project's e2e |
| **Startup assertion** | Assert a characteristic identifying the application under test (title / version endpoint) | **A false green when another process holds the port** |
| **Slow optional initialisation** | Skip the parts irrelevant to what is under test, behind a switch | Tens of seconds wasted on every run |

The startup assertion is the easiest to overlook, and it is **the only defence against a false green** — without it, a suite whose port is taken will connect to a completely unrelated service and "pass".

---

## 3. Protocol mocks — the shape for "it really can connect" tests

The smoke track **never touches a real external environment**. To verify "the application really can connect to some external service", stand up a tiny protocol mock:

**Four hard requirements:**

1. **A zero-dependency single file**, in `e2e/fixtures/`. Written with what the runtime already provides (Node's `net`, Go's standard library).
2. **Started as a separate process**, managed by the test framework (a second Playwright `webServer`, or brought up by the orchestration script), with a port readiness probe.
3. **The port is passed to the spec through an environment variable**, not hard-coded in the spec.
4. **It implements only the few responses the client handshake genuinely needs**, not a full server.

```js
// e2e/fixtures/redis-mock.mjs — answers only what the go-redis connection handshake needs
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

When a real protocol handshake is needed (SSH, TLS), stand up a minimal server with the language's standard library and have it **echo back what it received** — so the spec can assert "the server really received the command shown in the UI", rather than merely "nothing errored".

### Programmable fake models (AI / LLM scenarios)

Run the **real** call chain against a mock service. The mock implements just enough protocol + a control endpoint, with **the spec deciding what the "model" does — no behaviour hard-coded in the mock**:

```ts
await scriptModel([
  { tool: { name: "help", args: { asset } } },
  { tool: { name: "exec", args: { asset, command: "uptime" } } },
  { text: "done" },
]);
```

That way each spec defines its own scenario while the mock stays generic, rather than growing into a pile of if-else as the specs multiply.

---

## 4. An independent oracle — do not trust the UI alone

Besides asserting the UI, **query the data source directly** to cross-check. Trusting the UI alone misses bugs like "the interface says success but nothing was ever written to the database".

```ts
import { DatabaseSync } from "node:sqlite";

function readDb(path: string, sql: string) {
  const db = new DatabaseSync(path, { readonly: true });   // ← opened read-only
  try { return db.prepare(sql).all(); } finally { db.close(); }
}

// in the spec:
await createAssetViaUI(page, { name: "e2e-host" });
const rows = readDb(dbPath, "SELECT name FROM assets WHERE deleted_at IS NULL");
expect(rows.map(r => r.name)).toContain("e2e-host");
```

For a project with no database, apply the same idea differently: read structured logs and assert a line, call a read-only endpoint for state, read an output file. **The point is that the assertion path does not share a source with the UI assertion path.**

---

## 5. The orchestration script (not shell)

Write the orchestration script in **a real language the project already builds with** (Node, Go, Python — whichever the repository already carries), with `make` / a package-manager script as a thin forwarding layer. The reasons: **cross-platform behaviour** (Windows has no `pkill` / `mkdir -p`), and **cleanup logic needs real conditionals**. The skeleton below is Node; the responsibilities, not the syntax, are the part that transfers.

Responsibilities:

```js
// the skeleton of e2e/run-e2e.mjs
const tmpDir = mkdtempSync(join(tmpdir(), "<project>-e2e-"));
const logPath = join(tmpdir(), "<project>-e2e-webserver.log");

let code = 1;
try {
  code = await runPlaywright({ env: { DATA_DIR: tmpDir, /* … */ } });
} finally {
  reapOrphans();                        // reap leftover build/dev-server processes
  rmSync(tmpDir, { recursive: true, force: true });
  if (code === 0) rmSync(logPath, { force: true });   // ← delete the log only on success
  // Keep the log on failure — it is the only lead for investigating
}
process.exit(code);
```

**"Delete the log only on success, keep it on failure" gets written in.** Deleting the log along with everything else on failure is the easiest and most painful mistake to make.

---

## 6. Real-hardware verification goes through `.env`

Only the **local verification track** may hit a real environment. Four rules:

1. **The application itself does not read `.env`** — only the e2e harness loads it into the environment during a test run, **skipping it when the file is absent** (nobody should be blocked because someone else has not created a `.env`).
2. **`.env` is gitignored, `.env.example` is committed.**
3. **A real target = real side effects (not hermetic). Run only read-only / non-destructive operations, and clean up afterwards.**
4. **The smoke suite never uses it.**

How to write `.env.example` (template in `templates/env.example`):

- The comment at the top states the four rules above + who reads it.
- **One `KEY=value` per line, with no inline comments** — so that `cp .env.example .env` is readable by the simplest possible parser.
- One block per service, and **delete any block you do not need**.
- Write each service's particular traps next to it (e.g. the private key path must be absolute, because `~` is not expanded when read).

Loading on the harness side:

```ts
// e2e/playwright.config.ts
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env")) {                      // ← skipped when absent
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) process.env[m[1]] ??= m[2];         // existing environment variables win
  }
}
```

---

## 7. Evidence directory layout

```
e2e/scratch/<task-name>/
├── report.md          # the human-readable report — start reading here
├── logs/              # command output and run logs
├── resources/         # input fixtures, exported files, captured payloads, before/after data snapshots
├── screenshots/       # UI only
└── videos/            # UI only, and only when sequencing cannot be described
```

**The form of evidence follows the runtime form in section 8.** A CLI or server API scenario directory usually holds only `report.md`, `logs/` and `resources/` — the verdict rests on command + exit code + those few lines of stdout, or on request/status code/response body, not on pictures.

Recording is enabled explicitly rather than by default (it slows every scratch run):

```bash
E2E_RECORD_VIDEO_DIR=e2e/scratch/<task-name>/videos \
  <scratch command> -g "<test name>"
```

One run may produce several recording files (the harness may open helper pages); **keep them all under the same videos/**.

The rules for the report itself are in `templates/docs/references/verification-report-template.md`.

---

## 8. Choose the driver by runtime form

| Form | Driver | Its particular traps |
|---|---|---|
| Web application | Playwright / Cypress | Be explicit about a real backend versus a mock one; authentication state has to be plantable |
| Browser extension | Playwright + `--load-extension` | Optional permissions have to be granted up front (often needing a two-phase launch); permission dialogs must be auto-approved; background script changes require reloading the extension |
| Desktop application (Wails/Tauri) | The browser bridge dev mode exposes + Playwright | A native window will appear (expected); the single-instance lock has to be skipped; the port has to be dedicated |
| Desktop application (Electron) | Playwright's Electron support | The main process and the renderer process are driven separately |
| CLI | Run the binary directly and assert stdout/exit code/output files | The simplest, so prefer it; use a pty for an interactive CLI |
| Server API | Start the real service + an HTTP client | Data seeding and cleanup have to be idempotent |

**If a cheaper form can verify it, do not use an expensive one.** Do not start a browser for a behaviour observable through a CLI or an API.

---

## 9. What belongs in the smoke suite

At initialisation, stand up these and **no more**:

1. **The application starts** — asserting a characteristic that identifies it (guarding against a false green).
2. **Main navigation** — every main area is reachable and renders.
3. **One core CRUD path** — create → visible in the interface → **confirmed persisted via the independent oracle** → delete.
4. **One critical data-integrity path** — the one the project can least afford to break.

Every later addition passes the bar: **is it a core flow? is it stable?** Both have to be yes.

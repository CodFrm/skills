# Build the E2E harness

`SKILL.md` selects smoke vs scratch. This file owns implementation. Use the repository's existing runtime/toolchain; examples use Playwright vocabulary only when applicable.

`../templates/e2e/README.md` is the independently distributed project manual. The mechanical guarantees below are intentional copies; change both files together.

## 1. Separate smoke and scratch mechanically

The main config must exclude `e2e/scratch/`; a second config must target only it. Gitignore alone is insufficient.

```ts
// smoke/CI
defineConfig({ testDir: "./e2e", testIgnore: ["**/scratch/**"], workers: 1 })
// local scratch
defineConfig({ ...base, testDir: "./e2e/scratch", testIgnore: [] })
```

Add `e2e/scratch/` to `.gitignore`.

## 2. Make smoke hermetic

| Resource | Required isolation |
|---|---|
| Data/config/database | per-run temporary directory, removed after run |
| Credentials/keychain | explicit test key/override; never real store |
| Socket/lock files | derive from temporary directory |
| Single-instance lock | bypass under explicit e2e marker |
| Ports | dedicated per harness; no developer-instance default |
| Startup | assert an app-specific title/version/endpoint so a port collision cannot pass |
| Slow unrelated startup | skip through explicit test switch |

## 3. Mock external protocols, not internal code paths

Each smoke dependency mock is one zero-dependency file under `e2e/fixtures/`, starts as a managed process, exposes readiness, receives its port through environment, and implements only the handshake/responses needed by the test. For programmable model/AI mocks, the spec supplies each scripted response through a control endpoint; the mock contains no scenario-specific branching.

## 4. Use an independent oracle

In addition to the driven UI/API, read persisted data, structured logs, a read-only endpoint or output file through a path that does not share the UI's source. A success banner alone cannot prove persistence.

## 5. Orchestrate in a project language

Use a language the repository already builds, with package/Make commands as thin entry points. The runner must create isolated state, start/stop managed processes, reap leftovers, delete temporary data, and retain logs/artifacts on failure while cleaning successful-run output.

## 6. Authorize real-environment scratch runs

Only scratch may load `.env`; the application and smoke suite must not. Commit `.env.example`, ignore `.env`, let real environment variables override file values, and run only user-authorized side effects with isolated test data and cleanup.

A service `.env` does not configure is asked for, not arranged: standing the dependency up or substituting a mock both make the verdict describe an environment nobody chose. Name the service and the absent variables and ask the user.

## 7. Configure evidence output

[`verification-report-template.md`](../templates/docs/references/verification-report-template.md) owns directory layout and evidence forms. Configure every artifact under the supplied scenario root. Enable video only when sequence matters; keep decisive still frames.

## 8. Match driver to runtime

| Runtime | Driver |
|---|---|
| Web | Playwright/Cypress with explicit real-vs-mock backend |
| Browser extension | browser automation with extension loading/permissions/reload |
| Wails/Tauri | browser bridge dev mode plus browser automation |
| Electron | Electron-aware driver for main/renderer |
| CLI | binary invocation; PTY only when interactive |
| Server API | real service plus HTTP client and idempotent data cleanup |

Use the cheapest form that observes the contract.

## 9. Initial smoke scope

Commit only stable core flows: application identity/startup, main navigation, one core CRUD path verified by the independent oracle, and one critical data-integrity path. Everything else starts in scratch and is promoted only by a separate user/project decision.

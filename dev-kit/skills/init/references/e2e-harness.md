# Build the E2E harness

`SKILL.md` selects smoke vs scratch. Implement with the repository's runtime/toolchain; use Playwright vocabulary only when applicable.

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

Each smoke dependency mock is a zero-dependency file under `e2e/fixtures/`: run it as a managed process, expose readiness, pass its port through environment, and implement only required protocol responses. Supply programmable model responses through a control endpoint, without scenario branches in the mock.

## 4. Use an independent oracle

Verify through persisted data, structured logs, a read-only endpoint, or an output file independent of the driven UI/API source. A success banner does not prove persistence.

## 5. Orchestrate in a project language

Use a language the repository builds, with thin package/Make entry points. The runner creates isolated state, manages and reaps processes, deletes temporary data, retains failure artifacts, and cleans successful output.

## 6. Authorize real-environment scratch runs

Only scratch may load `.env`; the application and smoke suite must not. Commit `.env.example`, ignore `.env`, let environment variables override file values, and authorize side effects with isolated data and cleanup.

If `.env` omits a service, name it and its missing variables and ask the user; do not start or substitute it.

## 7. Configure evidence output

[`verification-report-template.md`](../templates/docs/references/verification-report-template.md) owns layout and evidence forms. Put every artifact under the scenario root before temporary state is removed. Enable video only when sequence matters; retain decisive stills.

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

Commit stable core flows only: identity/startup, main navigation, one oracle-verified CRUD path, and one critical integrity path. Keep other flows in scratch until separately approved.

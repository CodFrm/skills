<!-- Replace project placeholders and delete unused sections/comment. This independently distributed manual intentionally copies the harness guarantees from dev-kit init/references/e2e-harness.md; change both together. -->

# E2E

## 1. Tracks

| | Smoke | Local verification |
|---|---|---|
| Path | `e2e/<smoke>/` (committed) | `e2e/scratch/` (gitignored) |
| Command | `<smoke command>` | `<scratch command>` |
| Scope | stable core regression flows | one-off current change/bug |
| External systems | mocked | authorized real environment allowed |
| Output | CI verdict | `<task-name>/report.md` and evidence |

Promotion from scratch to smoke is a separate decision. Initial smoke scope: app identity/startup, main navigation, one core CRUD flow with independent persistence oracle, and one critical integrity path.

## 2. Harness

```text
<command> → <orchestrator>
  → real <application>
  → managed protocol mocks
  → <driver>
  → assertions + <independent oracle>
```

Environment isolation:

| Resource | Project mechanism |
|---|---|
| data/config/database | `<per-run temp override>` |
| credentials/keychain | `<test-key override>` |
| locks/sockets/single instance | `<e2e marker/derived path>` |
| ports | `<dedicated ports>` |
| app identity | `<title/version/endpoint assertion>` |

Run only one instance when `<shared local limitation>` applies.

## 3. Smoke command and coverage

```bash
<one-time dependency/browser setup>
<smoke command>
```

Current committed scenarios: `<spec → owned core flow>`.

## 4. Protocol mocks

Place zero-dependency mocks under `e2e/fixtures/`. Start each as a managed process with readiness; pass its port through environment; implement only required handshakes/responses. For model/AI calls, scenario scripts control responses through `<control mechanism>` rather than mock-internal branching.

## 5. Orchestration and cleanup

`<orchestrator path>` creates isolated data, starts/stops processes, reaps leftovers, deletes successful-run temporary output, and retains `<logs/artifacts>` on failure.

## 6. Writing a scratch script (local verification)

Write under `e2e/scratch/<task-name>/`, run `<scratch command>`, reuse harness isolation/fixtures/oracle, and follow [`../docs/verification.md`](../docs/verification.md). Its report template owns verdicts and evidence.

The main config excludes scratch with `<setting>`; the scratch config targets only scratch with `<setting>`. This mechanical separation keeps CI from collecting local scripts.

### Real environment

<!-- Keep only when selected. -->

Copy [`../.env.example`](../.env.example) to ignored `.env`. Only the harness loads it; smoke and the application do not. Obtain authorization for real side effects, isolate test data and clean up.

A service `.env` does not configure is asked for, not arranged: starting the dependency or substituting a mock makes the verdict describe an environment nobody chose. Name the service and the absent variables and ask the user.

## 7. Failure investigation

```bash
<log/artifact commands and paths>
```

## Related

[`../docs/verification.md`](../docs/verification.md) · [`../docs/testing.md`](../docs/testing.md) · [`../AGENTS.md`](../AGENTS.md)

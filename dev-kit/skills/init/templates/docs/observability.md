<!-- Generate only selected blocks backed by real infrastructure. Lift project wrapper/calls; replace placeholders and delete this comment. -->

# Observability

## Logging

Entry point: `<project wrapper/path>`. Do not bypass it with `<underlying/stdout APIs>`. Enforcement: `<check/config/exemption or review-only>`.

```<language>
<real representative structured call with context/correlation id>
```

| Level | Use |
|---|---|
| ERROR | failed and requires human action |
| WARN | degraded/retried/fallback but still operating |
| INFO | production milestone in a critical flow |
| DEBUG | investigation-only intermediate state |

Instrument external boundaries, state changes, permission decisions, failure/degradation and long-task lifecycle. Dynamic values use structured fields; messages follow `<prefix convention>`; correlation field is `<name>`.

Never log secrets, tokens, cookies, keys, credentials, personal/payment data or full sensitive payloads. Use `<project redaction/identifier form>`. Enforcement: `<check/exemption>`.

## Metrics

<!-- Keep only with metrics infrastructure. -->

| Signal | Metric/type |
|---|---|
| Traffic | `<counter>` |
| Errors by bounded reason | `<counter>` |
| Latency | `<histogram>` |
| Saturation | `<gauge>` |

Naming: `<convention>`. Labels must have bounded cardinality; identifiers, URLs and raw error text belong in logs.

## Distributed tracing

<!-- Keep only across services/processes. -->

Create spans at `<external/process/async boundaries>`, propagate context through `<project mechanism>`, and include trace id in structured logs.

## Verifying and reproducing with observability data

1. Enable DEBUG through `<real mechanism>`.
2. Run the reproduction/verification.
3. Filter one operation by correlation id.
4. Put only deciding redacted lines in the report and cross-check with `<database/read-only endpoint/output file>`.

For background/cross-process behaviour, a specific log/metric/data change is evidence; absence of errors is not.

## Common investigation commands

```bash
<log location>
<filter by level/correlation/time>
<extract structured fields>
<query independent oracle>
```

## Related

[`develop.md`](develop.md) · [`verification.md`](verification.md) · [`testing.md`](testing.md)

# When to ask the user

This file owns the shared decision gate. `init` carries a labelled standalone copy; change both together.

## Three tiers: findable / cheap-if-wrong / rework-if-wrong

Evaluate each open item in order and stop at the first match:

| # | Criterion | Action | Evidence |
|---|---|---|---|
| 1 | Findable in repository/environment | Look it up; do not ask | command/output or `file:line` |
| 2 | Not findable; cheap to reverse and not user-observable | Decide, state the basis, continue | repository precedent or refutable default |
| 3 | Wrong means user-visible rework, irreversible cost or policy choice | Ask | user's words |

Match evidence to the decision:

| Decision | Acceptable evidence |
|---|---|
| Current state | command/output or `file:line` |
| Scale | enumerated count |
| Internal selection | repository precedent; otherwise a named ecosystem default marked as such |
| Requirement | user's words or approved spec |
| External material | opened version/path/URL/ref; otherwise mark unverified |

## Ask in an executable form

A question gives mutually exclusive options, recommendation first, its evidence, each effect and whether work can continue. Batch independent questions; `brainstorming` asks one at a time.

Stop when an unanswered tier-3 choice changes the result. Do not turn silence into approval.

## Gates that never collapse into inference

- explicit approval of the finished spec;
- `init` recommendation selection;
- destructive deletion/discard/overwrite after listing exact losses;
- external or irreversible side effects after stating what will be touched.

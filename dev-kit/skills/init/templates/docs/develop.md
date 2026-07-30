<!--
Template: docs/develop.md
Usage: copy into the project's docs/, replace <angle brackets> with real content, and delete
this comment block at the end.
This file owns the concrete "how": commands, directory structure, code style, enforced rules,
the commit and PR flow.
It does not own: engineering principles (AGENTS.md), test design (testing.md), or the design
system's visual language (design.md).

⚠️ Every command here must genuinely exist and have been run by you. Inventing commands is the
most common initialisation accident.
-->

# Development standards

> The engineering principles are in [`../AGENTS.md`](../AGENTS.md). This file is the mechanism: commands, structure, style, enforced rules, the commit flow.

## Common commands

<!-- Run each one before writing it in. State when each is used. -->

```bash
<install dependencies>
<dev mode / hot reload>
<build>
<run>

<full test suite>
<targeted tests>
<coverage>

<lint>
<lint autofix>
<typecheck>
<format>

<generate code / mocks>          # if any
```

- The package manager is **<pnpm / go mod / uv ...>**. <State the enforcement mechanism, if any>
- <This repository's particular traps, e.g.: `go test ./...` picks up a directory it should not, so use `<alternative command>` by default>

> **These are this repository's only command entry points.** The docs, pre-commit and CI all call them; do not write an equivalent bare command anywhere else — three copies drifting apart produce "green locally, red in CI" with nobody knowing why.
> <In a front-and-back-end monorepo, state the boundary: front-end commands go through `<package manager>`, and back-end and cross-stack aggregate commands go through `make`.>

## Directory structure

```
<directory tree, one line of description per directory>
```

<!-- List the path aliases if there are any -->
Path aliases: `<@App/*>` → `<src/*>` (defined in `<config file>`).

## Code style

- **Formatting** is owned by <tool>; do not adjust formatting by hand. Run `<command>` before committing.
- <Naming conventions>
- <File organisation convention: e.g. tests co-located with source / a separate tests directory>
- <Import order and type-import conventions>

## Enforced rules (already mechanically checked)

<!-- Each entry: the rule → the correct form → why → enforcement and exemption.
     Conventions with no mechanical check do not go in this section; they go in the
     corresponding topic document. -->

| Rule | Correct form | Enforcement |
| --- | --- | --- |
| <No literal colours> | <Use a semantic token, see design.md> | <rule name> in `<config file>`; exemption: `<path>` |
| <Visible strings must go through i18n> | <Use t(), and update every locale file> | <rule name>; exemption: test files |
| <Success messages go through the notify wrapper> | <notifySuccess()> | <rule name>; exemption: the wrapper itself and its tests |
| <Layer A must not import layer B> | <Obtain it through the getter> | <check name>, running inside `<command>` |

> Each rule's guard test is at `<guard test path>` — it runs by loading the real configuration and asserts in both directions. **When changing these rules, change the guard test at the same time.**

<!-- Keep when there is i18n -->
## i18n

- Source language: <language>. Locale file location: <path>.
- Adding visible text → use `<the t function>`, **and update every locale file**.
- **Do not** use `t(key, { defaultValue })` — on a missing key it falls back silently and bypasses the key check.
- **Do not** translate dynamic content (user input, terminal output, markdown, logs).
- Key completeness is checked by `<validation script>`, wired into `<lint command>` and pre-commit.

<!-- Keep when there are logging conventions -->
## Logging on critical flows

- Use `<project logger>`, not `<the standard library log / console.log>`.
- Message prefix `<package.Method:>`, with dynamic values in **structured fields** rather than string concatenation.
- **What counts as a critical flow**: <enumerate: external calls, state changes, permission decisions, failure paths>.

## When touching persistent data

<!-- Keep when the project has any persistence (database, messaging, files on disk, client-side
     local storage); delete this section for a purely stateless project -->

**Code can be `git revert`ed; data already written out cannot.** Whenever a change will rewrite or reinterpret **data that already exists** — <enumerate this project's forms: `<schema / migrations>`, `<message body schema>`, `<export file format>`, `<client-side local storage>`> — follow the steps below rather than treating it as an ordinary change:

1. **Say it before changing it.** In the PR / issue / requirements discussion, state: what changes, how much existing data it affects, whether it can be rolled back, and which parts are irreversible. **Dropping columns or tables, losing precision and destructive backfills get named separately with a backup / export plan**, rather than being waved past in the change list.
2. **Structure and backfill go in two separate commits** — combined, a backfill blowing up leaves you unable to tell whether the DDL or the data was at fault, and rollback can only unwind the whole thing.
3. **Migrations are append-only; history is not edited** — environments that already ran them will not re-run. See "Data and migrations" in [`architecture.md`](./architecture.md).
4. **Verify in both directions against a database holding real existing data**: `<migration up command>` and `<migration down command>` once each, keeping two results of the same query before and after (row counts, edge values of the rewritten fields, NULL counts). **Green on an empty database is the same as not running it.**
5. **Review escalates a tier**: this class of PR requires `<two reviewers / the data owner's sign-off>`, and the reviewer specifically looks at: whether the migration is rerunnable, whether the backward direction really restores the data, edge values in the existing data (NULL / empty string / dirty values / two historical shapes), whether the backfill can be batched and re-run after an interruption, how old and new code read each other's data during a rolling release, and whether the existing data was confirmed to satisfy a unique/not-null constraint before it was added.

## Commits and PRs

### Commit messages

<Format convention, e.g. Conventional Commits>

```
<type>(<scope>): <short description>
```

### Before committing

The pre-commit hook automatically runs <checks>. It **checks only staged files**, and checks the **snapshot in the git index rather than the working tree** — so "stage the broken version, revert the working tree to the good one" cannot get past it.

In an emergency you can skip it with `SKIP_PRE_COMMIT=1 git commit`, **but state the reason in the PR**.

### PR description

<PR structure requirements + evidence requirements>

- State **what changed** and **why**.
- **Paste the verification commands you actually ran and their results**, rather than just "tests pass".
- Attach evidence for user-facing changes (command and output / logs / UI screenshots / a report link); see [`verification.md`](./verification.md).
- **For anything touching persistent data**, list the changes, the blast radius and the rollback plan per the section above, and paste the forward and backward migration commands with their exit codes.

## The CI gate

<!-- Pick one and write it honestly; do not pretend there is a gate -->

<With CI:> Merging requires passing `<job name>` in `<CI config file>`, which runs: <lint (including every guardrail), typecheck, tests (including guard tests), build, smoke e2e>. **It runs the same commands as local development.**

<Without CI:> **This repository has no merge-blocking CI gate.** The guardrails take effect only in local `<lint command>` and pre-commit, and pre-commit can be skipped — meaning violations **can** get merged. Please run `<lint command>` and `<test command>` yourself before committing.

## Related documents

- Engineering principles → [`../AGENTS.md`](../AGENTS.md)
- Layering and extension recipes → [`architecture.md`](./architecture.md)
- Logging and observability → [`observability.md`](./observability.md)
- How tests are designed, what to write and what not to → [`testing.md`](./testing.md)
- End-to-end verification and reports → [`verification.md`](./verification.md)
- The design system → [`design.md`](./design.md)
- Documentation maintenance → [`documentation.md`](./documentation.md)

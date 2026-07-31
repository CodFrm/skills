'use strict'

// Run: node --test dev-kit/tests/*.test.js
//
// Covers the SessionStart hook by running the real script. It fails invisibly: malformed JSON, or
// JSON whose additionalContext lost half the bootstrap to a missed escape, does not fail loudly —
// the session just starts without dev-kit. So the assertions are the round trip a harness performs:
// parse the output, and check the bootstrap came back out of it intact.

const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const HOOKS_DIR = path.join(__dirname, '..', 'hooks')
const SESSION_START = path.join(HOOKS_DIR, 'session-start')
const BOOTSTRAP = path.join(__dirname, '..', 'skills', 'using-dev-kit', 'SKILL.md')

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-hooks-')))

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))

// Invoked through bash rather than by path, so a lost executable bit fails one dedicated test below
// instead of every test here with an EACCES nobody reads as "chmod +x".
// CLAUDE_PLUGIN_ROOT only selects the output shape — the script finds the bootstrap relative to its
// own directory — and is set to the real root to match how Claude Code invokes the hook. COPILOT_CLI
// is cleared throughout: set, it flips the Claude Code branch back to the flat shape.
function run(script = SESSION_START, { pluginRoot, codexPluginRoot } = {}) {
  const env = { ...process.env }
  delete env.COPILOT_CLI
  delete env.CLAUDE_PLUGIN_ROOT
  delete env.PLUGIN_ROOT
  if (pluginRoot) env.CLAUDE_PLUGIN_ROOT = pluginRoot
  if (codexPluginRoot) {
    env.PLUGIN_ROOT = codexPluginRoot
    env.CLAUDE_PLUGIN_ROOT = codexPluginRoot
  }
  const r = spawnSync('bash', [script], { env, encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

const PLUGIN_ROOT = path.join(__dirname, '..')

test('the hook exits 0 and its output parses as JSON', () => {
  const r = run(SESSION_START, { pluginRoot: PLUGIN_ROOT })
  assert.equal(r.code, 0, r.err)
  assert.doesNotThrow(() => JSON.parse(r.out), 'a harness parses this; malformed JSON is a silent no-op')
})

test('the injected context carries the using-dev-kit bootstrap', () => {
  const r = run(SESSION_START, { pluginRoot: PLUGIN_ROOT })
  const ctx = JSON.parse(r.out).hookSpecificOutput.additionalContext
  assert.match(ctx, /<EXTREMELY_IMPORTANT>/)
  assert.match(ctx, /name: using-dev-kit/)
  assert.match(ctx, /dev-kit:using-dev-kit bootstrap/)
})

test('the whole SKILL.md file comes back out, so the hook and the file cannot drift apart', () => {
  // Not a hardcoded excerpt: the file itself is the expectation, so a reworded bootstrap needs no
  // change here, while a hook that reads the wrong path — or truncates — fails immediately.
  const body = fs.readFileSync(BOOTSTRAP, 'utf8').trimEnd()
  const r = run(SESSION_START, { pluginRoot: PLUGIN_ROOT })
  const ctx = JSON.parse(r.out).hookSpecificOutput.additionalContext
  assert.ok(ctx.includes(body), 'the emitted context must contain SKILL.md verbatim')
})

test('JSON escaping survives the real file: quotes, backslashes, tabs and newlines', () => {
  // An escaping bug does not corrupt the output, it truncates at the first offending character —
  // often into JSON that still parses. The premise is asserted first: if SKILL.md ever stops
  // containing these characters, this test has stopped testing anything and should say so.
  const body = fs.readFileSync(BOOTSTRAP, 'utf8')
  assert.ok(body.includes('"'), 'fixture premise: SKILL.md contains a double quote')
  assert.ok(body.includes('\\'), 'fixture premise: SKILL.md contains a backslash')
  assert.ok(body.includes('\n'), 'fixture premise: SKILL.md contains newlines')

  const r = run(SESSION_START, { pluginRoot: PLUGIN_ROOT })
  const ctx = JSON.parse(r.out).hookSpecificOutput.additionalContext
  for (const line of body.split('\n')) {
    if (line.includes('"') || line.includes('\\')) assert.ok(ctx.includes(line), `lost line: ${line}`)
  }
  assert.ok(ctx.length >= body.length, 'nothing may be dropped on the way through JSON')
})

test('Claude Code gets the nested hookSpecificOutput shape', () => {
  const j = JSON.parse(run(SESSION_START, { pluginRoot: PLUGIN_ROOT }).out)
  assert.equal(j.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.equal(typeof j.hookSpecificOutput.additionalContext, 'string')
  assert.equal(j.additionalContext, undefined, 'only the field this platform reads is emitted')
})

test('Codex gets top-level additionalContext even with its Claude compatibility variable', () => {
  const j = JSON.parse(run(SESSION_START, { codexPluginRoot: PLUGIN_ROOT }).out)
  assert.equal(typeof j.additionalContext, 'string')
  assert.equal(j.hookSpecificOutput, undefined)
})

test('everything else gets the flat additionalContext shape', () => {
  const j = JSON.parse(run(SESSION_START).out)
  assert.equal(typeof j.additionalContext, 'string')
  assert.equal(j.hookSpecificOutput, undefined)
  assert.match(j.additionalContext, /name: using-dev-kit/)
})

test('a missing or empty bootstrap injects nothing rather than an error message', () => {
  // Injecting "Error reading …" would be wrapped in <EXTREMELY_IMPORTANT> and become the agent's
  // bootstrap, which is worse than injecting nothing at all.
  const fake = path.join(tmp, 'plugin', 'hooks')
  fs.mkdirSync(fake, { recursive: true })
  fs.copyFileSync(SESSION_START, path.join(fake, 'session-start'))

  const missing = run(path.join(fake, 'session-start'))
  assert.equal(missing.code, 0, 'a hook that exits non-zero is reported to the user as a failure')
  assert.equal(missing.out, '')

  fs.mkdirSync(path.join(tmp, 'plugin', 'skills', 'using-dev-kit'), { recursive: true })
  fs.writeFileSync(path.join(tmp, 'plugin', 'skills', 'using-dev-kit', 'SKILL.md'), '')
  const empty = run(path.join(fake, 'session-start'))
  assert.equal(empty.code, 0)
  assert.equal(empty.out, '')
})

test('the hook scripts are executable and have a shebang', () => {
  // Claude Code runs run-hook.cmd directly; without the mode bit the plugin is inert on install.
  for (const name of ['session-start', 'run-hook.cmd']) {
    const p = path.join(HOOKS_DIR, name)
    assert.ok(fs.statSync(p).mode & 0o111, `${name} must be executable`)
  }
  assert.match(fs.readFileSync(SESSION_START, 'utf8'), /^#!\/usr\/bin\/env bash\n/)
})

test('run-hook.cmd dispatches to the named script', () => {
  const r = spawnSync('bash', [path.join(HOOKS_DIR, 'run-hook.cmd'), 'session-start'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(JSON.parse(r.stdout).additionalContext ?? '', /name: using-dev-kit/)
})

test('run-hook.cmd refuses an empty script name instead of exec-ing its own directory', () => {
  const r = spawnSync('bash', [path.join(HOOKS_DIR, 'run-hook.cmd')], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /missing script name/)
})

test('hooks.json registers one cross-harness SessionStart hook', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(HOOKS_DIR, 'hooks.json'), 'utf8'))
  assert.deepEqual(Object.keys(cfg.hooks), ['SessionStart'])
  assert.equal(cfg.hooks.SessionStart.length, 1)
  assert.equal(cfg.hooks.SessionStart[0].matcher, 'startup|resume|clear|compact')

  const commands = cfg.hooks.SessionStart[0].hooks
  assert.equal(commands.length, 1)
  assert.match(commands[0].command, /PLUGIN_ROOT/)
  assert.match(commands[0].command, /CLAUDE_PLUGIN_ROOT/)
  assert.match(commands[0].command, /run-hook\.cmd" session-start$/)
  assert.ok(fs.existsSync(SESSION_START), 'hooks.json must not name a script that is not there')
})

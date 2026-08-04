'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const USING_DEV_KIT = path.join(__dirname, '..', 'skills', 'using-dev-kit')

function read(relativePath) {
  return fs.readFileSync(path.join(USING_DEV_KIT, relativePath), 'utf8')
}

function readRoot(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function section(markdown, heading) {
  const marker = `## ${heading}`
  const start = markdown.indexOf(marker)
  assert.notEqual(start, -1, `missing ${marker}`)
  const bodyStart = start + marker.length
  const next = markdown.indexOf('\n## ', bodyStart)
  return markdown.slice(bodyStart, next === -1 ? undefined : next)
}

function assertPiSingleTaskMapping(mapping) {
  const dispatch = section(mapping, 'Optional dev-kit subagent')
  assert.match(dispatch, /actual tool list for the exact tool name `subagent`/)
  assert.match(dispatch, /When `subagent` is absent, offer only `inline`/)
  assert.match(dispatch, /When `subagent` is present, offer `subagent` and `inline`/)
  assert.match(dispatch, /Each `subagent` call starts one fresh child for one task\./)
  assert.match(dispatch, /only fields are required `task` and `profile`, plus optional `model`, `thinking`, and `cwd`/)
  assert.match(dispatch, /`tasks`, `chain`, `tools`, and every other unknown field fail before launch without compatibility conversion/)
  assert.match(dispatch, /Only the wrap-up spec-verification and code-review axes send multiple sibling `subagent` calls in one assistant message; Pi runs them concurrently\./)
  assert.doesNotMatch(dispatch, /parallel-is-proved-not-assumed|exact current HEAD|approves parallel dispatch|parallel_evidence/)
  assert.match(dispatch, /keeps no scheduler or queue/)
  assert.match(dispatch, /does not cancel or retry sibling calls/)
  assert.match(dispatch, /does not aggregate their results/)
  assert.match(dispatch, /never writes `\.dev-kit\/plans\/\*\.yaml`/)

  const profiles = section(mapping, 'Profiles and tool resolution')
  assert.match(profiles, /`read-only` uses the fixed `read,bash,grep,find,ls` set/)
  assert.match(profiles, /prompt forbidding file, repository-state, and external-system changes/)
  assert.match(profiles, /bash is only for read-only inspection/)
  assert.match(profiles, /`write` uses the fixed `read,bash,edit,write,grep,find,ls` set for tasks that need no project-custom tools/)
  assert.match(profiles, /task prompt and project rules own the write boundary/)
  assert.match(profiles, /`general` inherits the parent Pi active tools, deduplicated while preserving first occurrence, and excludes the exact name `subagent`/)
  assert.match(profiles, /If filtering leaves no tools, the child starts with none instead of falling back to the base or registered sets/)
  assert.match(profiles, /does not expand from all registered tools/)
  assert.match(profiles, /unavailable inherited tool fails with Pi diagnostics rather than being silently removed or replaced/)
  assert.match(profiles, /It is not an OS sandbox/)

  const recursion = section(mapping, 'Recursion boundary')
  assert.match(recursion, /resolved child tool set excludes `subagent`/)
  assert.match(recursion, /child-registration marker prevents the extension from registering `subagent` in the child/)
  assert.match(recursion, /child system prompt says it executes one dispatched task/)
  assert.match(recursion, /must obey `using-dev-kit`'s `SUBAGENT-STOP`/)

  const runtime = section(mapping, 'Model, working directory and trust')
  assert.match(runtime, /Resolve `cheap`, `mid`, or `strong` plan tiers to a real `provider\/model` in the main session at dispatch/)
  assert.match(runtime, /package does not infer or persist that mapping/)
  assert.match(runtime, /Omitted or blank `model` and `thinking` inherit the parent values/)
  assert.match(runtime, /Omitted or blank `cwd` uses the parent cwd; a nonblank supplied path is resolved from it and must be a directory/)
  assert.match(runtime, /trusted in-tree cwd uses one-time approval; an untrusted or out-of-tree cwd uses one-time rejection/)
  assert.match(runtime, /independent Pi JSON\/print process with no session persistence/)
  assert.match(runtime, /JSONL progress continues to stream into the current call/)
  assert.match(runtime, /failure evidence retain the task, progress, final output, usage, model, exit code, stop reason, error, stderr, signal, and abort details/)
  assert.match(runtime, /A parent abort requests termination of only this call's child, then force-kills it after the timeout; it does not cancel or retry siblings/)
  assert.match(runtime, /main session owns mechanical evidence checks, plan state, and review boundaries/)
  assert.match(runtime, /child result is a report, not permission to change the plan/)
}

test('using-dev-kit routes platform-specific tool names to one owned reference each', () => {
  const skill = read('SKILL.md')
  for (const platform of ['codex', 'claude', 'pi']) {
    assert.match(skill, new RegExp(`references/${platform}-tools\\.md`))
  }
})

test('Codex mapping uses the collaboration tools exposed by the current harness', () => {
  const mapping = read('references/codex-tools.md')
  for (const tool of ['spawn_agent', 'wait_agent', 'send_message', 'followup_task', 'interrupt_agent', 'list_agents', 'update_plan']) {
    assert.match(mapping, new RegExp(`\\b${tool}\\b`))
  }
  assert.doesNotMatch(mapping, /\bclose_agent\b/)
  assert.match(mapping, /Dispatch is serial by default; only the wrap-up spec-verification and code-review axes use multiple `spawn_agent` calls, bounded by the available slots\./)
  assert.doesNotMatch(mapping, /gate-approved parallel batch|concurrency gate|parallel-is-proved-not-assumed/)
})

test('Claude mapping keeps native subagents and task tracking distinct', () => {
  const mapping = read('references/claude-tools.md')
  assert.match(mapping, /`Task`/)
  assert.match(mapping, /`TodoWrite`/)
  assert.match(mapping, /Dispatch is serial by default; the wrap-up spec-verification and code-review axes are the sole parallel exception, issuing multiple `Task` calls in one message\./)
  assert.doesNotMatch(mapping, /gate-approved parallel batch|concurrency gate|parallel-is-proved-not-assumed/)
})

test('Pi mapping translates the logical namespace and stays within the base tool set', () => {
  const mapping = read('references/pi-tools.md')
  assert.match(mapping, /`dev-kit:<name>`/)
  assert.match(mapping, /`<name>`/)
  assert.match(mapping, /`\/skill:<name>`/)
  assert.match(mapping, /inline/)
  assert.match(mapping, /read,bash,edit,write,grep,find,ls/)
  assert.match(mapping, /Do not recursively launch another `pi` process/)
  assert.doesNotMatch(mapping, /verified against `@earendil-works\/pi-coding-agent` 0\.\d+/)
  assert.doesNotMatch(mapping, /`spawn_agent`|`Task` tool/)
})

test('Pi mapping asserts the single-task runtime contract rather than keyword coverage', () => {
  assertPiSingleTaskMapping(read('references/pi-tools.md'))
})

test('Pi mapping contract rejects legacy batch guidance even when current keywords are present', () => {
  const staleMapping = `
## Optional dev-kit subagent
Inspect the actual tool list for the exact tool name \`subagent\`. When \`subagent\` is absent, offer only \`inline\`. When \`subagent\` is present, offer \`subagent\` and \`inline\`.
One task can be sent directly, or \`tasks\` can send a batch and \`chain\` can pass prior output. The main session owns serial work and may make multiple \`subagent\` calls. Invalid \`tasks\`, \`chain\`, and \`tools\` values reject. Fields include \`task\`, \`profile\`, \`model\`, \`thinking\`, and \`cwd\`.
## Profiles and tool resolution
Profiles are read-only, write, and general. Active tools are deduplicated. It is not an OS sandbox.
## Recursion boundary
Three layers prevent recursion.
## Model, working directory and trust
Model, cwd, trust, output, failure, and abort behavior are retained.
`
  assert.throws(() => assertPiSingleTaskMapping(staleMapping), /one fresh child/)
})

test('Pi public guidance preserves installation and attribution while rejecting the old contract', () => {
  const catalog = readRoot('README.md')
  const packageReadme = readRoot('dev-kit/.pi/extensions/subagent/README.md')
  const notice = readRoot('dev-kit/.pi/extensions/subagent/NOTICE.md')

  assert.match(catalog, /可选 Pi 单任务派发集成.*每次调用启动一个独立子进程.*主会话负责串行依赖和获准的并行 sibling calls.*基础 dev-kit 仍保持 inline/)
  assert.doesNotMatch(catalog, /single、parallel 与 chain/)

  assert.match(packageReadme, /基础 `dev-kit\/package\.json` 不引用本包/)
  assert.match(packageReadme, /pi install \/path\/to\/skills\/dev-kit\/\.pi\/extensions\/subagent/)
  assert.match(packageReadme, /执行 `\/reload` 后检查当前工具列表/)
  assert.match(packageReadme, /pi list\npi remove <pi list 中显示的本地 source>/)
  assert.match(packageReadme, /未安装、禁用、移除或尚未 reload 时只提供 `inline`/)

  const contract = section(packageReadme, '调用契约')
  assert.match(contract, /```ts\nsubagent\(\{\n  task: string,\n  profile: "read-only" \| "write" \| "general",\n  model\?: string,\n  thinking\?: string,\n  cwd\?: string\n\}\)\n```/)
  assert.match(contract, /`task` 和 `profile` 必填；每次成功调用对应一个新的子进程和一个任务结果/)
  assert.match(contract, /`tasks`、`chain`、`tools` 以及其他未知字段都会在启动前拒绝，不做兼容转换/)

  const orchestration = section(packageReadme, '编排边界')
  assert.match(orchestration, /主会话默认串行处理依赖/)
  assert.match(orchestration, /唯一例外是 wrap-up 的 spec 验证轴与 code review 轴，二者可在同一 assistant message 中发送多个并行 sibling `subagent` calls/)
  assert.doesNotMatch(orchestration, /parallel-is-proved-not-assumed|当前精确 HEAD|批准并行派发/)
  assert.match(orchestration, /不保留 scheduler 或 queue.*不聚合 sibling results.*不写 `\.dev-kit\/plans\/\*\.yaml`/)
  assert.match(orchestration, /前一个调用返回后.*新的完整 task.*不会机械传递前序输出或自行选择后续步骤/)

  const profiles = section(packageReadme, 'Profiles and tool resolution')
  assert.match(profiles, /`write`.*不需要项目自定义工具的落盘任务/)
  assert.match(profiles, /`general`.*父会话当前 active tools.*排除精确名称 `subagent`/)
  assert.match(profiles, /过滤后为空时以无工具模式启动/)
  assert.match(profiles, /不从 registered tools 扩大集合/)
  assert.match(profiles, /不是 OS sandbox/)
  assert.match(profiles, /父 active tool 在子进程中不可用.*返回 Pi 诊断.*不静默删除能力或 fallback/)

  const recursion = section(packageReadme, 'Recursion boundary')
  assert.match(recursion, /递归由三层共同阻断/)
  assert.match(recursion, /child registration marker/)
  assert.match(recursion, /system prompt/)

  const runtime = section(packageReadme, 'Model, working directory and trust')
  assert.match(runtime, /未提供或留空 `model`、`thinking` 时继承父会话当前值/)
  assert.match(runtime, /显式非空 model 不存在、未认证或不能启动时保留原始失败诊断，不静默 fallback/)
  assert.match(runtime, /未提供或留空 `cwd` 时使用父会话 cwd；提供非空路径时相对父 cwd 解析并在启动前确认是目录/)
  assert.match(runtime, /父项目已信任.*一次性 approval.*否则.*一次性拒绝/)
  assert.match(runtime, /独立的 Pi JSON\/print 子进程并关闭 session 持久化/)

  const output = section(packageReadme, '输出与失败')
  assert.match(output, /JSONL 事件继续流式进入当前工具调用/)
  assert.match(output, /exit code、stop reason、错误消息、stderr、最后输出、signal 和 abort 证据/)
  assert.match(output, /父调用 abort 只终止当前调用的子进程，超时后强制结束；不会取消或重试 sibling calls/)
  assert.match(output, /父会话负责机械证据检查、plan 状态和 review 边界/)
  assert.match(output, /子 agent 的结果是报告，不是状态转换许可/)

  assert.doesNotMatch(packageReadme, /parallel 与 chain 把|最多八项|同时最多四个进程|显式 `tools`|`tools` 可以/)
  assert.match(notice, /Source: https:\/\/github\.com\/earendil-works\/pi\/tree\/v0\.82\.1\/packages\/coding-agent\/examples\/extensions\/subagent/)
  assert.match(notice, /Author: Mario Zechner/)
  assert.match(notice, /License: MIT/)
  assert.match(notice, /one fresh child process per call/)
  assert.match(notice, /built-in `read-only`, `write`, and `general` profiles and runtime model selection/)
  assert.doesNotMatch(notice, /single\/parallel\/chain execution model|concurrency limits?|streaming result collection|output cap/i)
})

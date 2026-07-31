'use strict'

const fs = require('node:fs')

const args = process.argv.slice(2)
const promptIndex = args.indexOf('--append-system-prompt')
const promptPath = promptIndex === -1 ? null : args[promptIndex + 1]
const capture = {
  args,
  cwd: process.cwd(),
  systemPrompt: promptPath ? fs.readFileSync(promptPath, 'utf8') : null,
}

if (process.env.FAKE_PI_CAPTURE) {
  fs.appendFileSync(process.env.FAKE_PI_CAPTURE, `${JSON.stringify(capture)}\n`)
}

const stopReason = process.env.FAKE_PI_STOP_REASON || 'end'
const message = {
  role: 'assistant',
  content: [{ type: 'text', text: process.env.FAKE_PI_OUTPUT || 'fake subagent completed' }],
  usage: {
    input: 11,
    output: 7,
    cacheRead: 3,
    cacheWrite: 2,
    cost: { total: 0.0123 },
    totalTokens: 23,
  },
  model: process.env.FAKE_PI_MODEL || 'fake-provider/fake-model',
  stopReason,
}

if (process.env.FAKE_PI_ERROR_MESSAGE) message.errorMessage = process.env.FAKE_PI_ERROR_MESSAGE
console.log(JSON.stringify({ type: 'message_end', message }))
if (process.env.FAKE_PI_STDERR) process.stderr.write(process.env.FAKE_PI_STDERR)
process.exit(Number(process.env.FAKE_PI_EXIT_CODE || 0))

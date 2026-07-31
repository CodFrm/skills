'use strict'

const fs = require('node:fs')

const args = process.argv.slice(2)
const task = args.at(-1) || ''
const promptIndex = args.indexOf('--append-system-prompt')
const promptPath = promptIndex === -1 ? null : args[promptIndex + 1]
const outputMarker = task.match(/\[output=([^\]]*)\]/)
const delayMarker = task.match(/\[delay=(\d+)\]/)
const signalMarker = task.match(/\[signal=(SIG[A-Z]+)\]/)
const markedFailure = task.includes('[fail]')
const capture = {
  args,
  cwd: process.cwd(),
  systemPrompt: promptPath ? fs.readFileSync(promptPath, 'utf8') : null,
}

if (process.env.FAKE_PI_CAPTURE) {
  fs.appendFileSync(process.env.FAKE_PI_CAPTURE, `${JSON.stringify(capture)}\n`)
}
recordTimeline('start')

let finished = false
process.on('SIGTERM', () => {
  if (finished) return
  recordTimeline('aborted')
  process.exit(143)
})

const delay = Number(delayMarker?.[1] || process.env.FAKE_PI_DELAY_MS || 0)
setTimeout(() => {
  if (signalMarker) {
    recordTimeline('signaled')
    process.kill(process.pid, signalMarker[1])
    return
  }
  const stopReason = process.env.FAKE_PI_STOP_REASON || (markedFailure ? 'error' : 'end')
  const message = {
    role: 'assistant',
    content: [{ type: 'text', text: process.env.FAKE_PI_OUTPUT || outputMarker?.[1] || 'fake subagent completed' }],
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

  const errorMessage = process.env.FAKE_PI_ERROR_MESSAGE || (markedFailure ? 'marked fake failure' : undefined)
  if (errorMessage) message.errorMessage = errorMessage
  console.log(JSON.stringify({ type: 'message_end', message }))
  const stderr = process.env.FAKE_PI_STDERR || (markedFailure ? 'marked fake stderr' : '')
  if (stderr) process.stderr.write(stderr)
  finished = true
  recordTimeline('end')
  process.exit(Number(process.env.FAKE_PI_EXIT_CODE || (markedFailure ? 2 : 0)))
}, delay)

function recordTimeline(event) {
  if (!process.env.FAKE_PI_TIMELINE) return
  fs.appendFileSync(process.env.FAKE_PI_TIMELINE, `${JSON.stringify({ event, pid: process.pid, time: Date.now(), task })}\n`)
}

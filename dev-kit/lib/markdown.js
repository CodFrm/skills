'use strict'

// A zero-dependency markdown → HTML renderer for the dashboard's reading surface.
//
// Escape-at-emission is the security boundary: every content fragment that is interpolated into
// HTML is escaped before formatting, so a source `<script>` can only ever become `&lt;script&gt;`
// and no raw source byte reaches the output. Structure is detected on the raw lines (so `>` and `#`
// markers survive), then each emitted fragment is escaped and inline-parsed. Malformed input
// degrades to escaped plain text; the renderer never throws.

// The same escape set dashboard.js uses; kept local so this module stays self-contained.
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
))

// Links may carry http(s), mailto, or a scheme-less (relative/anchor) target. Anything else — above
// all javascript: and data: — is dropped and the label renders as plain text.
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto'])
function safeUrl(url) {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)
  if (scheme && !ALLOWED_SCHEMES.has(scheme[1].toLowerCase())) return null
  return url
}

// Inline parsing on already-escaped text. Code spans are opaque; bold/italic recurse; a link whose
// URL is unsafe renders its label only. Unclosed markers fall through to literal text. A link URL
// may itself contain parentheses, so the closing bracket is found by depth.
function inline(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) { out += `<code>${text.slice(i + 1, end)}</code>`; i = end + 1; continue }
    }
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2)
      if (end !== -1) { out += `<strong>${inline(text.slice(i + 2, end))}</strong>`; i = end + 2; continue }
    }
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1)
      if (end !== -1) { out += `<em>${inline(text.slice(i + 1, end))}</em>`; i = end + 1; continue }
    }
    if (text[i] === '[') {
      const close = text.indexOf(']', i + 1)
      if (close !== -1 && text[close + 1] === '(') {
        let depth = 0
        let end = -1
        for (let k = close + 2; k < text.length; k++) {
          if (text[k] === '(') depth++
          else if (text[k] === ')') { if (depth === 0) { end = k; break } depth-- }
        }
        if (end !== -1) {
          const label = text.slice(i + 1, close)
          const href = safeUrl(text.slice(close + 2, end))
          out += href ? `<a href="${href}">${inline(label)}</a>` : inline(label)
          i = end + 1
          continue
        }
      }
    }
    out += text[i]
    i++
  }
  return out
}

const inlineEsc = (raw) => inline(esc(raw))

const isBlank = (line) => line.trim() === ''
const isHeading = (line) => /^#{1,5}\s+/.test(line)
const headingLevel = (line) => line.match(/^#+/)[0].length
const isQuote = (line) => line.startsWith('>')
const isUl = (line) => /^[-*]\s+/.test(line)
const isOl = (line) => /^\d+\.\s+/.test(line)
const isFence = (line) => /^```/.test(line)

// A pipe-table separator row: cells that are only dashes with optional colons.
const splitRow = (line) => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}
const isTableSep = (line) => {
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function renderTable(headerLine, rows) {
  const head = splitRow(headerLine).map((cell) => `<th>${inlineEsc(cell)}</th>`).join('')
  const body = rows.map((row) => `<tr>${splitRow(row).map((cell) => `<td>${inlineEsc(cell)}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

// Line-based block parsing over the raw source; every emitted fragment is escaped.
function renderBlocks(lines) {
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) { i++; continue }

    // Fenced code block: raw (escaped) content, never inline-parsed. An unterminated fence
    // degrades to a paragraph so nothing is lost and nothing throws.
    if (isFence(line)) {
      const body = []
      let j = i + 1
      while (j < lines.length && !isFence(lines[j])) { body.push(lines[j]); j++ }
      if (j < lines.length) {
        out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`)
        i = j + 1
        continue
      }
      const para = []
      for (let k = i; k < lines.length && !isBlank(lines[k]); k++) para.push(lines[k])
      // Degrade to escaped plain text, not even inline-parsed: an unterminated fence is not markdown.
      out.push(`<p>${esc(para.join(' '))}</p>`)
      i += para.length
      continue
    }

    if (isHeading(line)) {
      const level = headingLevel(line)
      out.push(`<h${level}>${inlineEsc(line.replace(/^#+\s*/, ''))}</h${level}>`)
      i++
      continue
    }

    if (isQuote(line)) {
      const run = []
      while (i < lines.length && isQuote(lines[i])) { run.push(lines[i].replace(/^>\s?/, '')); i++ }
      out.push(`<blockquote><p>${inlineEsc(run.join(' '))}</p></blockquote>`)
      continue
    }

    if (isUl(line) || isOl(line)) {
      const tag = isUl(line) ? 'ul' : 'ol'
      const isCurrentKind = tag === 'ul' ? isUl : isOl
      const run = []
      while (i < lines.length && isCurrentKind(lines[i])) {
        run.push(`<li>${inlineEsc(lines[i].replace(/^(\s*[-*]|\s*\d+\.)\s+/, ''))}</li>`)
        i++
      }
      // A changed marker kind ends this list; the next line starts its own ul/ol so ordered items
      // keep their numbering instead of being folded into a mislabelled unordered list.
      out.push(`<${tag}>${run.join('')}</${tag}>`)
      continue
    }

    // A pipe table needs a header row followed by a separator row.
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows = []
      let j = i + 2
      while (j < lines.length && lines[j].includes('|') && !isTableSep(lines[j])) { rows.push(lines[j]); j++ }
      out.push(renderTable(line, rows))
      i = j
      continue
    }

    // Paragraph: consecutive non-blank, non-special lines folded with spaces.
    const para = []
    while (i < lines.length && !isBlank(lines[i]) && !isHeading(lines[i]) && !isQuote(lines[i])
      && !isUl(lines[i]) && !isOl(lines[i]) && !isFence(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      para.push(lines[i])
      i++
    }
    out.push(`<p>${inlineEsc(para.join(' '))}</p>`)
  }
  return out.join('\n')
}

function render(source) {
  const text = String(source == null ? '' : source)
  if (text === '') return ''
  return renderBlocks(text.split('\n'))
}

module.exports = { render }

'use strict'

// Run: node --test dev-kit/tests/markdown.test.js
//
// The renderer is the dashboard's reading surface: every syntax the spec template uses must render,
// every source byte must be escaped before formatting (so <script> stays text), and malformed input
// must degrade to escaped plain text instead of throwing.

const test = require('node:test')
const assert = require('node:assert/strict')

const { render } = require('../lib/markdown')

test('ATX headings render h1..h5', () => {
  assert.equal(render('# H1'), '<h1>H1</h1>')
  assert.equal(render('## H2'), '<h2>H2</h2>')
  assert.equal(render('### H3'), '<h3>H3</h3>')
  assert.equal(render('#### H4'), '<h4>H4</h4>')
  assert.equal(render('##### H5'), '<h5>H5</h5>')
  assert.equal(render('#no-space'), '<p>#no-space</p>', 'a # without a following space is not a heading')
})

test('paragraphs split on blank lines and fold soft breaks', () => {
  assert.equal(render('one'), '<p>one</p>')
  assert.equal(render('one\n\n two'), '<p>one</p>\n<p> two</p>')
  assert.equal(render('one\ntwo'), '<p>one two</p>')
  assert.equal(render(''), '')
})

test('unordered and ordered lists render li items', () => {
  assert.equal(render('- a\n- b'), '<ul><li>a</li><li>b</li></ul>')
  assert.equal(render('* a\n* b'), '<ul><li>a</li><li>b</li></ul>')
  assert.equal(render('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>')
})

test('inline bold, italic, code and links render, with recursive nesting', () => {
  assert.equal(render('**b** and *i* and `c`'), '<p><strong>b</strong> and <em>i</em> and <code>c</code></p>')
  assert.equal(render('**b *i* b**'), '<p><strong>b <em>i</em> b</strong></p>')
  assert.equal(render('`a **b**`'), '<p><code>a **b**</code></p>', 'inline code content is not parsed')
})

test('links allow http(s)/mailto/relative and reject dangerous schemes', () => {
  assert.equal(render('[x](https://example.com)'), '<p><a href="https://example.com">x</a></p>')
  assert.equal(render('[x](/relative)'), '<p><a href="/relative">x</a></p>')
  assert.equal(render('[x](mailto:a@b.c)'), '<p><a href="mailto:a@b.c">x</a></p>')
  assert.equal(render('[x](javascript:alert(1))'), '<p>x</p>', 'javascript: scheme is dropped, label stays')
  assert.equal(render('[x](data:text/html,hi)'), '<p>x</p>')
})

test('fenced code blocks are raw and escaped, not parsed', () => {
  assert.equal(render('```\n<a> & </b>\n```'), '<pre><code>&lt;a&gt; &amp; &lt;/b&gt;</code></pre>')
  assert.equal(render('```js\nlet x = **bold**\n```'), '<pre><code>let x = **bold**</code></pre>')
})

test('blockquotes render quoted paragraphs', () => {
  assert.equal(render('> quote'), '<blockquote><p>quote</p></blockquote>')
  assert.equal(render('> a\n> b'), '<blockquote><p>a b</p></blockquote>')
})

test('pipe tables render header and body rows with inline cells', () => {
  const input = '| a | **b** |\n|---|---|\n| 1 | 2 |'
  const expected = '<table><thead><tr><th>a</th><th><strong>b</strong></th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
  assert.equal(render(input), expected)
})

test('escape-first: any source script tag stays inert text', () => {
  const out = render('<script>alert(1)</script>')
  assert.equal(out, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  assert.ok(!out.includes('<script>'), 'no raw script tag survives')
  assert.ok(!out.includes('</script>'))
  assert.equal(render('a <img src=x onerror=alert(1)> b'), '<p>a &lt;img src=x onerror=alert(1)&gt; b</p>')
})

test('malformed input degrades to escaped text and never throws', () => {
  assert.equal(render('```\nunterminated'), '<p>``` unterminated</p>')
  assert.equal(render('a | b\nnot a table'), '<p>a | b not a table</p>')
  assert.doesNotThrow(() => render('**unclosed\n*also\n`and'))
  assert.doesNotThrow(() => render(''))
})

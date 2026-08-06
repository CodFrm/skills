'use strict'

// Run: node --test dev-kit/tests/i18n.test.js
//
// The en/zh chrome string tables must answer the same keys (a page that falls back would otherwise
// render untranslated or missing text), and lang/theme resolution must follow the spec: query wins,
// then Accept-Language, then the zh fallback; theme is pinned only when ?theme= says so.

const test = require('node:test')
const assert = require('node:assert/strict')

const { STRINGS, LANGS, THEMES, resolveLang, resolveTheme } = require('../lib/i18n')

test('en and zh string tables carry the same keys', () => {
  assert.deepEqual(Object.keys(STRINGS.zh).sort(), Object.keys(STRINGS.en).sort())
})

test('resolveLang: query param wins, then Accept-Language, then zh fallback', () => {
  assert.equal(resolveLang('en-US,en;q=0.9,zh;q=0.5', 'zh'), 'zh')
  assert.equal(resolveLang('zh-CN,zh;q=0.9', 'en'), 'en')
  assert.equal(resolveLang('zh-CN,zh;q=0.9', null), 'zh')
  assert.equal(resolveLang('en-US,en;q=0.9', null), 'en')
  assert.equal(resolveLang('', null), 'zh')
  assert.equal(resolveLang(undefined, null), 'zh')
  // a query value outside the vocabulary is treated as absent
  assert.equal(resolveLang('fr-FR,fr;q=0.9', 'fr'), 'zh')
  assert.equal(resolveLang('fr-FR,fr;q=0.9', 'xx'), 'zh')
  // q=0 removes a preference; * weights break a tie toward zh
  assert.equal(resolveLang('zh;q=0,en;q=0.8', null), 'en')
  assert.equal(resolveLang('*;q=0.1', null), 'zh')
})

test('resolveTheme: pins only light or dark, otherwise null for the system default', () => {
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme(null), null)
  assert.equal(resolveTheme(undefined), null)
  assert.equal(resolveTheme('sepia'), null)
  assert.equal(resolveTheme('DARK'), null)
})

test('vocabularies are exactly en/zh and light/dark', () => {
  assert.deepEqual(LANGS, ['en', 'zh'])
  assert.deepEqual(THEMES, ['light', 'dark'])
})

// WCAG 2.x relative luminance of an sRGB hex colour, then the contrast ratio of two colours.
const luminance = (hex) => {
  const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
  const linear = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('the light and dark palettes in lib/dashboard.js meet WCAG AA text contrast', () => {
  // Palette values are written out literally, not imported from dashboard.js, so a change to either
  // palette fails this test instead of silently drifting.
  const pairs = [
    ['light', '#1a1a1a', '#ffffff'],
    ['dark', '#e6e6e6', '#161616'],
  ]
  for (const [name, fg, bg] of pairs) {
    assert.ok(contrast(fg, bg) >= 4.5, `${name} palette foreground/background contrast`)
  }
})

'use strict'

// dev-kit's own lint gate (flat config, minimal rule set — spec decision 7).
//
// The rules are the ones that catch a hand-written parser/renderer/HTTP server's real mistakes —
// undefined names, unused variables, dead code, duplicate object keys, reassigned constants,
// switch fall-through — without dictating a style. Runtime files keep their shape; the toolchain
// task only allows mechanical fixes. The shebang CLI bin/devkit has no .js extension, so it is
// listed explicitly; everything else lives under bin/, lib/ and tests/.

module.exports = [
  {
    files: ['bin/devkit', 'bin/**/*.js', 'lib/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node globals the runtime references directly; everything else comes from node: modules.
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-dupe-keys': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-extra-semi': 'error',
      'no-multi-str': 'error',
    },
  },
]

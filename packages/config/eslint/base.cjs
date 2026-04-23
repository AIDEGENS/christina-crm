'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    // Default: warn. Product code in apps/** escalates to error via the
    // override below — PHI-safety requires using the scrubbing logger,
    // never raw console.
    'no-console': 'warn',
  },
  overrides: [
    {
      // Phase 0.6 — application code must route through
      // @christina-crm/observability's scrubbing logger. A stray
      // `console.log({ patient_mrn: ... })` would ship PHI to stdout
      // (and then to Datadog) unfiltered.
      files: ['apps/**/*.{ts,tsx,js,jsx}'],
      rules: {
        'no-console': ['error', { allow: [] }],
      },
    },
    {
      // Tests are free to use console for debugging. They also never
      // receive real PHI.
      files: [
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/__tests__/**',
      ],
      rules: {
        'no-console': 'off',
      },
    },
    {
      // One-off ops scripts (scripts/**) are interactive CLIs where
      // console output IS the UX. Allow.
      files: ['scripts/**/*.{ts,tsx,js,cjs,mjs,sh}'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};

'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['./packages/config/eslint/base.cjs'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.next/',
    '.turbo/',
    'coverage/',
  ],
};

import js from '@eslint/js';
import html from 'eslint-plugin-html';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['**/*.html'],
    plugins: { html },
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];

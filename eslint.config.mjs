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
  {
    files: ['tests/**/*.js', '.claude/skills/verify/**/*.js', 'playwright.config.mjs'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          ["MemberExpression[object.name='test'][property.name=/^(only|skip|fixme|fail|slow)$/]", 'Não pule nem relaxe testes.'],
          ["MemberExpression[object.property.name='describe'][property.name=/^(only|skip|fixme|configure)$/]", 'Não pule nem repita testes.'],
          ["CallExpression[callee.property.name=/^(waitForTimeout|setTimeout|setDefaultTimeout|setDefaultNavigationTimeout)$/]", 'Não acrescente espera nem aumente limites.'],
          ["CallExpression[callee.name='setTimeout']", 'Não acrescente espera fixa.'],
          ["CallExpression[callee.property.name='toPass']", 'Não repita asserções até passarem.'],
          ["MemberExpression[object.name='expect'][property.name='poll']", 'Não repita asserções até passarem.'],
          ["Property[key.name='retries'][value.value!=0]", 'Retries devem continuar em zero.'],
        ].map(([selector, message]) => ({ selector, message })),
      ],
    },
  },
];

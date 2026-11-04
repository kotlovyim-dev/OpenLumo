import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/next-env.d.ts', '**/.turbo/**', '**/migrations/**', 'data/**', 'graphify-out/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['site/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/core/**/*.ts'],
    ignores: ['packages/core/src/models/registry.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@openlumo/providers/openrouter'] }],
    },
  },
  {
    files: ['apps/worker/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@openlumo/db',
              allowImportNames: ['createDatabase', 'Database'],
              message: 'Worker code reaches tables through @openlumo/core repositories.',
            },
          ],
        },
      ],
    },
  },
);

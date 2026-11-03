import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**', '**/migrations/**', 'data/**', 'graphify-out/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/**/*.ts'],
    ignores: ['packages/core/src/models/registry.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@openlumo/providers/openrouter'] }],
    },
  },
);

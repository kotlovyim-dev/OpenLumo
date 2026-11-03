import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const envFile = new URL('.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['{apps,packages}/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.integration.test.ts', '**/*.live.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['{apps,packages}/**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'live',
          include: ['{apps,packages}/**/*.live.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});

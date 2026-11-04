import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const adminDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!adminDatabaseUrl) throw new Error('TEST_DATABASE_URL is not set');

const databaseUrl = new URL(adminDatabaseUrl);
databaseUrl.pathname = '/openlumo_e2e';

const webPort = 3200;
const fixtureSitePort = 4100;
const baseURL = `http://127.0.0.1:${webPort}`;

const env = {
  DATABASE_URL: databaseUrl.toString(),
  APP_SECRET: 'e2e-secret-that-is-at-least-32-characters-long',
  PUBLIC_URL: baseURL,
  STORAGE_DIRECTORY: join(tmpdir(), 'openlumo-e2e-assets'),
  OPENLUMO_TEST_PROVIDERS: 'fake',
  CRAWLER_ALLOW_PRIVATE_HOSTS: 'true',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'golden-path', testMatch: 'golden-path.spec.ts' },
    { name: 'error-states', testMatch: 'error-states.spec.ts', dependencies: ['golden-path'] },
  ],
  webServer: [
    {
      command: `tsx e2e/serve-fixture-site.ts ${fixtureSitePort}`,
      port: fixtureSitePort,
    },
    {
      command:
        'tsx e2e/prepare-database.ts && pnpm --filter @openlumo/db db:migrate && pnpm --filter @openlumo/worker start',
      env,
      wait: { stdout: /worker started/ },
      timeout: 120_000,
    },
    {
      command: `next build && tsx e2e/start-standalone.ts ${webPort}`,
      env,
      url: `${baseURL}/sign-in`,
      timeout: 300_000,
    },
  ],
});

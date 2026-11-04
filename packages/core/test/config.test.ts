import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const workspaceRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  APP_SECRET: 'a'.repeat(32),
  PUBLIC_URL: 'http://localhost:3000',
};

describe('loadConfig', () => {
  it('names APP_SECRET when it is 31 characters long', () => {
    expect(() => loadConfig({ ...valid, APP_SECRET: 'a'.repeat(31) })).toThrow(/APP_SECRET/);
  });

  it('applies defaults', () => {
    expect(loadConfig(valid)).toEqual({
      databaseUrl: valid.DATABASE_URL,
      appSecret: valid.APP_SECRET,
      storageDirectory: join(workspaceRoot, 'data', 'assets'),
      allowPrivateHosts: false,
      testProviders: undefined,
      globalJobConcurrency: 4,
      brandJobConcurrency: 2,
      publicUrl: valid.PUBLIC_URL,
    });
  });

  it('gives the web app and the worker the same storage directory', () => {
    const fromWeb = loadConfig(valid, join(workspaceRoot, 'apps', 'web')).storageDirectory;
    const fromWorker = loadConfig(valid, join(workspaceRoot, 'apps', 'worker')).storageDirectory;
    expect(fromWeb).toBe(join(workspaceRoot, 'data', 'assets'));
    expect(fromWorker).toBe(fromWeb);
  });

  it('keeps an absolute storage directory as it is', () => {
    const absolute = resolve('/srv/openlumo/assets');
    expect(loadConfig({ ...valid, STORAGE_DIRECTORY: absolute }).storageDirectory).toBe(absolute);
  });

  it('reads overrides', () => {
    const config = loadConfig({
      ...valid,
      CRAWLER_ALLOW_PRIVATE_HOSTS: 'true',
      OPENLUMO_TEST_PROVIDERS: 'fake',
      GLOBAL_JOB_CONCURRENCY: '8',
      BRAND_JOB_CONCURRENCY: '3',
    });
    expect(config).toMatchObject({
      allowPrivateHosts: true,
      testProviders: 'fake',
      globalJobConcurrency: 8,
      brandJobConcurrency: 3,
    });
  });
});

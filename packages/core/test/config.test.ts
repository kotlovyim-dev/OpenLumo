import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

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
      storageDirectory: './data/assets',
      allowPrivateHosts: false,
      testProviders: undefined,
      globalJobConcurrency: 4,
      brandJobConcurrency: 2,
      publicUrl: valid.PUBLIC_URL,
    });
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

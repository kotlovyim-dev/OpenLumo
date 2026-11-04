import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  STORAGE_DIRECTORY: z.string().min(1).default('./data/assets'),
  CRAWLER_ALLOW_PRIVATE_HOSTS: z.enum(['true', 'false']).default('false'),
  OPENLUMO_TEST_PROVIDERS: z.literal('fake').optional(),
  GLOBAL_JOB_CONCURRENCY: z.coerce.number().int().positive().default(4),
  BRAND_JOB_CONCURRENCY: z.coerce.number().int().positive().default(2),
  PUBLIC_URL: z.url(),
});

export type Config = {
  databaseUrl: string;
  appSecret: string;
  storageDirectory: string;
  allowPrivateHosts: boolean;
  testProviders: 'fake' | undefined;
  globalJobConcurrency: number;
  brandJobConcurrency: number;
  publicUrl: string;
};

function findWorkspaceRoot(start: string): string {
  for (let directory = start; ; directory = dirname(directory)) {
    if (existsSync(join(directory, 'pnpm-workspace.yaml'))) return directory;
    if (dirname(directory) === directory) return start;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv, cwd = process.cwd()): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration: ${problems.join('; ')}`);
  }
  const values = parsed.data;
  return {
    databaseUrl: values.DATABASE_URL,
    appSecret: values.APP_SECRET,
    storageDirectory: resolve(findWorkspaceRoot(cwd), values.STORAGE_DIRECTORY),
    allowPrivateHosts: values.CRAWLER_ALLOW_PRIVATE_HOSTS === 'true',
    testProviders: values.OPENLUMO_TEST_PROVIDERS,
    globalJobConcurrency: values.GLOBAL_JOB_CONCURRENCY,
    brandJobConcurrency: values.BRAND_JOB_CONCURRENCY,
    publicUrl: values.PUBLIC_URL,
  };
}

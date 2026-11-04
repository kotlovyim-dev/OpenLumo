import 'server-only';
import { createAssetStorage, createQueue, loadConfig, type Config, type Queue } from '@openlumo/core';
import { createDatabase, type Database } from '@openlumo/db';
import { memoizeUnlessRejected } from './memoize-unless-rejected';

type Runtime = {
  config: Config;
  db: Database;
  storage: ReturnType<typeof createAssetStorage>;
  getBoss: () => Promise<Queue>;
};

const cache = globalThis as typeof globalThis & { openlumoRuntime?: Runtime };

export function getRuntime(): Runtime {
  if (!cache.openlumoRuntime) {
    const config = loadConfig(process.env);
    cache.openlumoRuntime = {
      config,
      db: createDatabase(config.databaseUrl),
      storage: createAssetStorage(config.storageDirectory),
      getBoss: memoizeUnlessRejected(() => createQueue(config.databaseUrl, { supervise: false, schedule: false })),
    };
  }
  return cache.openlumoRuntime;
}

export function getBoss(): Promise<Queue> {
  return getRuntime().getBoss();
}

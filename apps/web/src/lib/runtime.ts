import 'server-only';
import { createAssetStorage, createQueue, loadConfig, type Config, type Queue } from '@openlumo/core';
import { createDatabase, type Database } from '@openlumo/db';

type Runtime = {
  config: Config;
  db: Database;
  storage: ReturnType<typeof createAssetStorage>;
  boss?: Promise<Queue>;
};

const cache = globalThis as typeof globalThis & { openlumoRuntime?: Runtime };

export function getRuntime(): Runtime {
  if (!cache.openlumoRuntime) {
    const config = loadConfig(process.env);
    cache.openlumoRuntime = {
      config,
      db: createDatabase(config.databaseUrl),
      storage: createAssetStorage(config.storageDirectory),
    };
  }
  return cache.openlumoRuntime;
}

export function getBoss(): Promise<Queue> {
  const runtime = getRuntime();
  runtime.boss ??= createQueue(runtime.config.databaseUrl, { supervise: false, schedule: false });
  return runtime.boss;
}

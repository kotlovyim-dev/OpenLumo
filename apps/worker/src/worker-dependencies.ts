import type { AssetStorage, Config, createQueue } from '@openlumo/core';
import type { Database } from '@openlumo/db';

export type WorkerDependencies = {
  db: Database;
  config: Config;
  storage: AssetStorage;
  boss: Awaited<ReturnType<typeof createQueue>>;
};

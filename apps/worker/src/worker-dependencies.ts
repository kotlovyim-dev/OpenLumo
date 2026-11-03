import type { AssetStorage, Config, Queue } from '@openlumo/core';
import type { Database } from '@openlumo/db';

export type WorkerDependencies = {
  db: Database;
  config: Config;
  storage: AssetStorage;
  boss: Queue;
};

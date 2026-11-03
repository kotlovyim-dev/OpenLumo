import type { AssetStorage, Config } from '@openlumo/core';
import type { Database } from '@openlumo/db';

export type WorkerDependencies = { db: Database; config: Config; storage: AssetStorage };

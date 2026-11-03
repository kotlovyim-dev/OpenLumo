import { existsSync } from 'node:fs';
import { createQueue, jobNames, loadConfig, startWorker } from '@openlumo/core';
import { createDatabase } from '@openlumo/db';
import { jobDefinitions } from './register-jobs';

const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig(process.env);
const db = createDatabase(config.databaseUrl);
const boss = await createQueue(config.databaseUrl, { createQueues: true });
await startWorker(boss, db, jobDefinitions, config);
console.log(`worker started; queues: ${jobNames.join(', ')}`);

async function shutdown() {
  await boss.stop();
  await db.$client.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

import { rm } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@openlumo/db';

const { TEST_DATABASE_URL, DATABASE_URL, STORAGE_DIRECTORY } = process.env;
if (!TEST_DATABASE_URL || !DATABASE_URL || !STORAGE_DIRECTORY) {
  throw new Error('TEST_DATABASE_URL, DATABASE_URL and STORAGE_DIRECTORY must be set');
}

const name = new URL(DATABASE_URL).pathname.slice(1);
if (name !== 'openlumo_e2e') throw new Error(`Refusing to recreate database ${name}`);
const admin = createDatabase(TEST_DATABASE_URL);
await admin.execute(sql.raw(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
await admin.execute(sql.raw(`CREATE DATABASE ${name}`));
await admin.$client.end();
await rm(STORAGE_DIRECTORY, { recursive: true, force: true });

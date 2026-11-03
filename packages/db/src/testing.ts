import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { createDatabase, type Database } from './client';

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

export async function createTestDatabase(): Promise<{ db: Database; url: string; drop(): Promise<void> }> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) throw new Error('TEST_DATABASE_URL is not set');

  const name = `openlumo_test_${randomBytes(6).toString('hex')}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const db = createDatabase(url.toString());
  await migrate(db, { migrationsFolder });

  return {
    db,
    url: url.toString(),
    async drop() {
      await db.$client.end();
      const dropper = new Client({ connectionString: adminUrl });
      await dropper.connect();
      await dropper.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await dropper.end();
    },
  };
}

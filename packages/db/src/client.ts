import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDatabase(url: string) {
  return drizzle(new Pool({ connectionString: url }), { schema });
}

export type Database = ReturnType<typeof createDatabase>;

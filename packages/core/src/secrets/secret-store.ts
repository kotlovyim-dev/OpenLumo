import { eq } from 'drizzle-orm';
import { secrets, type Database } from '@openlumo/db';
import { decryptSecret, encryptSecret } from './encryption';

export type SecretName = 'openrouter_api_key';

export async function saveSecret(db: Database, name: SecretName, value: string, appSecret: string): Promise<void> {
  const encrypted = encryptSecret(value, appSecret);
  await db
    .insert(secrets)
    .values({ name, ...encrypted })
    .onConflictDoUpdate({ target: secrets.name, set: encrypted });
}

export async function readSecret(db: Database, name: SecretName, appSecret: string): Promise<string | null> {
  const [row] = await db.select().from(secrets).where(eq(secrets.name, name));
  return row ? decryptSecret(row, appSecret) : null;
}

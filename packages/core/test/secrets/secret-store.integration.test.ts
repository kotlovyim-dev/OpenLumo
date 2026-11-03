import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { secrets, type Database } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { readSecret, saveSecret } from '../../src/secrets/secret-store';

const appSecret = 's'.repeat(32);

describe('secret store', () => {
  let db: Database;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase());
  });

  afterAll(async () => {
    await drop();
  });

  it('returns null for an unknown name', async () => {
    expect(await readSecret(db, 'openrouter_api_key', appSecret)).toBeNull();
  });

  it('keeps one row per name and returns the latest value', async () => {
    await saveSecret(db, 'openrouter_api_key', 'first', appSecret);
    await saveSecret(db, 'openrouter_api_key', 'second', appSecret);
    expect(await db.select().from(secrets)).toHaveLength(1);
    expect(await readSecret(db, 'openrouter_api_key', appSecret)).toBe('second');
  });
});

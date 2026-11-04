import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from '@openlumo/db';
import { createTestDatabase } from '@openlumo/db/testing';
import { createAuth } from '../src/lib/create-auth';

describe('role assignment on sign-up', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.drop();
  });

  it('makes the first user an admin and later users members', async () => {
    const auth = createAuth(database.db, {
      secret: 'test-secret-with-at-least-thirty-two-characters',
      baseURL: 'http://localhost:3000',
    });

    await auth.api.signUpEmail({ body: { name: 'First', email: 'first@example.com', password: 'password-123' } });
    await auth.api.signUpEmail({ body: { name: 'Second', email: 'second@example.com', password: 'password-123' } });

    const [first] = await database.db.select().from(users).where(eq(users.email, 'first@example.com'));
    const [second] = await database.db.select().from(users).where(eq(users.email, 'second@example.com'));
    expect(first?.role).toBe('admin');
    expect(second?.role).toBe('member');
  });

  it('ignores a client-supplied role', async () => {
    const auth = createAuth(database.db, {
      secret: 'test-secret-with-at-least-thirty-two-characters',
      baseURL: 'http://localhost:3000',
    });

    await auth.api.signUpEmail({ body: { name: 'Seed', email: 'seed@example.com', password: 'password-123' } });
    await auth.api.signUpEmail({
      body: { name: 'Sneaky', email: 'sneaky@example.com', password: 'password-123', role: 'admin' } as {
        name: string;
        email: string;
        password: string;
      },
    });

    const [sneaky] = await database.db.select().from(users).where(eq(users.email, 'sneaky@example.com'));
    expect(sneaky?.role).toBe('member');
  });
});

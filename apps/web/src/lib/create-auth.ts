import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { count } from 'drizzle-orm';
import { accounts, sessions, users, verifications, type Database } from '@openlumo/db';

export function createAuth(db: Database, options: { secret: string; baseURL: string }) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'member', input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            const [existing] = await db.select({ total: count() }).from(users);
            return { data: { ...user, role: existing?.total === 0 ? 'admin' : 'member' } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

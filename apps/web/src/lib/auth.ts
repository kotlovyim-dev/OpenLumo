import 'server-only';
import { createAuth, type Auth } from './create-auth';
import { getRuntime } from './runtime';

const cache = globalThis as typeof globalThis & { openlumoAuth?: Auth };

export function getAuth(): Auth {
  if (!cache.openlumoAuth) {
    const { config, db } = getRuntime();
    cache.openlumoAuth = createAuth(db, { secret: config.appSecret, baseURL: config.publicUrl });
  }
  return cache.openlumoAuth;
}

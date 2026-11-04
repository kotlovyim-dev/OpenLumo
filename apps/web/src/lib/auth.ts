import 'server-only';
import { toNextJsHandler } from 'better-auth/next-js';
import { createAuth, type Auth } from './create-auth';
import { getRuntime } from './runtime';

type AuthCache = { auth: Auth; handler: ReturnType<typeof toNextJsHandler> };

const cache = globalThis as typeof globalThis & { openlumoAuth?: AuthCache };

function getAuthCache(): AuthCache {
  if (!cache.openlumoAuth) {
    const { config, db } = getRuntime();
    const auth = createAuth(db, { secret: config.appSecret, baseURL: config.publicUrl });
    cache.openlumoAuth = { auth, handler: toNextJsHandler(auth) };
  }
  return cache.openlumoAuth;
}

export function getAuth(): Auth {
  return getAuthCache().auth;
}

export function getAuthHandler() {
  return getAuthCache().handler;
}

import { cp } from 'node:fs/promises';

const webDirectory = new URL('../', import.meta.url);
const standaloneDirectory = new URL('.next/standalone/apps/web/', webDirectory);

await cp(new URL('.next/static', webDirectory), new URL('.next/static', standaloneDirectory), { recursive: true });
await cp(new URL('public', webDirectory), new URL('public', standaloneDirectory), { recursive: true });

process.env.PORT = process.argv[2];
process.env.HOSTNAME = '127.0.0.1';
await import(new URL('server.js', standaloneDirectory).href);

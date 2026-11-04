import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDirectory = fileURLToPath(new URL('../../../packages/core/test-fixtures/site/', import.meta.url));
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.txt': 'text/plain',
};

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://fixture').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try {
    const body = await readFile(join(siteDirectory, file));
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(Number(process.argv[2]));

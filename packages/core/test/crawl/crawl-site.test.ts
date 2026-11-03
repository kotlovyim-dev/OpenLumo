import { readFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crawlSite } from '../../src/crawl/crawl-site';

const siteDir = fileURLToPath(new URL('../../test-fixtures/site/', import.meta.url));
const types: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.png': 'image/png',
  '.txt': 'text/plain',
};

let server: http.Server;
let origin: string;
let requested: string[];

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    requested.push(pathname);
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    try {
      const body = await readFile(path.join(siteDir, file));
      res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  requested = [];
});

describe('crawlSite', () => {
  it('visits index, about and pricing but never the robots-disallowed page', async () => {
    const result = await crawlSite(`${origin}/`, { allowPrivateHosts: true });
    const paths = result.pages.map((page) => new URL(page.url).pathname).sort();
    expect(paths).toEqual(['/', '/about.html', '/pricing.html']);
    expect(requested).not.toContain('/private.html');
  });

  it('stops at maxPages', async () => {
    const result = await crawlSite(`${origin}/`, { allowPrivateHosts: true, maxPages: 2 });
    expect(result.pages).toHaveLength(2);
  });

  it('builds the palette from the stylesheet with the primary colour first', async () => {
    const result = await crawlSite(`${origin}/`, { allowPrivateHosts: true });
    expect(result.palette[0]).toBe('#ff5a1f');
  });

  it('downloads the logo', async () => {
    const result = await crawlSite(`${origin}/`, { allowPrivateHosts: true });
    expect(result.logo?.url).toBe(`${origin}/logo.png`);
    expect(result.logo?.mimeType).toBe('image/png');
    expect(result.logo?.bytes.length).toBeGreaterThan(0);
  });

  it('keeps script content out of the text', async () => {
    const result = await crawlSite(`${origin}/`, { allowPrivateHosts: true });
    for (const page of result.pages) expect(page.text).not.toContain('SCRIPT_SECRET');
    expect(result.pages[0]?.text).toContain('Fresh bread');
  });

  it('rejects when the start url fails', async () => {
    await expect(crawlSite(`${origin}/missing.html`, { allowPrivateHosts: true })).rejects.toThrow();
  });
});

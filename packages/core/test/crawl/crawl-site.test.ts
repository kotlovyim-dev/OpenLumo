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

type TestServer = { server: http.Server; origin: string; requested: string[] };
type Handler = (pathname: string, res: http.ServerResponse) => void | Promise<void>;

const servers: TestServer[] = [];

async function start(handler: Handler): Promise<TestServer> {
  const requested: string[] = [];
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    requested.push(pathname);
    await handler(pathname, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const started = {
    server,
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requested,
  };
  servers.push(started);
  return started;
}

async function serveFixture(pathname: string, res: http.ServerResponse) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try {
    const body = await readFile(path.join(siteDir, file));
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}

function html(res: http.ServerResponse, body: string) {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<html><body>${body}</body></html>`);
}

afterAll(() =>
  Promise.all(servers.map((s) => new Promise<void>((resolve) => s.server.close(() => resolve())))),
);

describe('crawlSite with the fixture site', () => {
  let site: TestServer;
  beforeAll(async () => {
    site = await start(serveFixture);
  });
  beforeEach(() => {
    site.requested.length = 0;
  });

  it('visits index, about and pricing once each but never the robots-disallowed page', async () => {
    const result = await crawlSite(`${site.origin}/`, { allowPrivateHosts: true });
    const paths = result.pages.map((page) => new URL(page.url).pathname).sort();
    expect(paths).toEqual(['/', '/about.html', '/pricing.html']);
    expect(site.requested).not.toContain('/private.html');
    expect(site.requested).not.toContain('/index.html');
  });

  it('stops at maxPages', async () => {
    const result = await crawlSite(`${site.origin}/`, { allowPrivateHosts: true, maxPages: 2 });
    expect(result.pages).toHaveLength(2);
  });

  it('builds the palette from the stylesheet with the primary colour first', async () => {
    const result = await crawlSite(`${site.origin}/`, { allowPrivateHosts: true });
    expect(result.palette[0]).toBe('#ff5a1f');
  });

  it('downloads the logo', async () => {
    const result = await crawlSite(`${site.origin}/`, { allowPrivateHosts: true });
    expect(result.logo?.url).toBe(`${site.origin}/logo.png`);
    expect(result.logo?.mimeType).toBe('image/png');
    expect(result.logo?.bytes.length).toBeGreaterThan(0);
  });

  it('keeps script content out of the text', async () => {
    const result = await crawlSite(`${site.origin}/`, { allowPrivateHosts: true });
    for (const page of result.pages) expect(page.text).not.toContain('SCRIPT_SECRET');
    expect(result.pages[0]?.text).toContain('Fresh bread');
  });

  it('rejects when the start url fails', async () => {
    await expect(
      crawlSite(`${site.origin}/missing.html`, { allowPrivateHosts: true }),
    ).rejects.toThrow();
  });
});

describe('crawlSite across a redirected start url', () => {
  it('crawls the final origin and reads robots and styles from it', async () => {
    const target = await start(serveFixture);
    const redirector = await start((_, res) => {
      res.writeHead(302, { location: `${target.origin}/` }).end();
    });
    const result = await crawlSite(`${redirector.origin}/`, { allowPrivateHosts: true });
    const paths = result.pages.map((page) => new URL(page.url).pathname).sort();
    expect(paths).toEqual(['/', '/about.html', '/pricing.html']);
    expect(target.requested).toContain('/robots.txt');
    expect(target.requested).not.toContain('/private.html');
    expect(redirector.requested).not.toContain('/robots.txt');
    expect(result.palette[0]).toBe('#ff5a1f');
  });
});

describe('crawlSite resilience', () => {
  it('skips non-HTML responses and failing internal pages and keeps crawling', async () => {
    const site = await start((pathname, res) => {
      if (pathname === '/data.json') {
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"a":1}');
      } else if (pathname === '/broken') {
        res.writeHead(500).end();
      } else if (pathname === '/ok') {
        html(res, '<p>fine</p>');
      } else if (pathname === '/') {
        html(res, '<a href="/data.json">d</a><a href="/broken">b</a><a href="/ok">ok</a>');
      } else {
        res.writeHead(404).end();
      }
    });
    const result = await crawlSite(`${site.origin}/`, { allowPrivateHosts: true });
    expect(result.pages.map((page) => new URL(page.url).pathname).sort()).toEqual(['/', '/ok']);
  });

  it('runs at most 3 fetches at a time', async () => {
    let inFlight = 0;
    let peak = 0;
    const links = Array.from({ length: 9 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('');
    const site = await start(async (pathname, res) => {
      if (pathname === '/robots.txt') {
        res.writeHead(404).end();
        return;
      }
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;
      html(res, pathname === '/' ? links : '<p>page</p>');
    });
    const result = await crawlSite(`${site.origin}/`, { allowPrivateHosts: true, maxPages: 10 });
    expect(result.pages).toHaveLength(10);
    expect(peak).toBe(3);
  });
});

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { isPrivateAddress } from '../../src/crawl/private-address';
import { safeFetch, UnsafeUrlError } from '../../src/crawl/safe-fetch';

describe('isPrivateAddress', () => {
  it.each([
    ['10.1.2.3', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['172.32.0.1', false],
    ['192.168.1.1', true],
    ['127.0.0.1', true],
    ['169.254.169.254', true],
    ['0.0.0.0', true],
    ['100.64.0.1', true],
    ['100.128.0.1', false],
    ['255.255.255.255', true],
    ['8.8.8.8', false],
    ['93.184.216.34', false],
    ['::1', true],
    ['::', true],
    ['fc00::1', true],
    ['fd12:3456::1', true],
    ['fe80::1', true],
    ['::ffff:127.0.0.1', true],
    ['::ffff:7f00:1', true],
    ['::ffff:8.8.8.8', false],
    ['2606:4700:4700::1111', false],
  ])('%s -> %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe('safeFetch', () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = req.url ?? '/';
      if (path === '/ok') {
        res.setHeader('content-type', 'text/html');
        res.end('<p>hello</p>');
      } else if (path === '/big') {
        res.end(Buffer.alloc(3_000_000, 'a'));
      } else if (path === '/loop') {
        res.statusCode = 302;
        res.setHeader('location', '/loop');
        res.end();
      } else if (path === '/to-private') {
        res.statusCode = 302;
        res.setHeader('location', 'http://127.0.0.1:1/secret');
        res.end();
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  afterEach(() => vi.restoreAllMocks());

  it('rejects non-http schemes', async () => {
    await expect(safeFetch('ftp://example.com/file', { allowPrivateHosts: false })).rejects.toThrow(
      UnsafeUrlError,
    );
  });

  it('rejects localhost unless private hosts are allowed', async () => {
    await expect(safeFetch(`${base}/ok`, { allowPrivateHosts: false })).rejects.toThrow(
      UnsafeUrlError,
    );
    await expect(safeFetch('http://localhost/', { allowPrivateHosts: false })).rejects.toThrow(
      UnsafeUrlError,
    );
    const result = await safeFetch(`${base}/ok`, { allowPrivateHosts: true });
    expect(result.status).toBe(200);
    expect(result.contentType).toBe('text/html');
    expect(new TextDecoder().decode(result.body)).toBe('<p>hello</p>');
    expect(result.finalUrl).toBe(`${base}/ok`);
  });

  it.each(['http://[::1]/', 'http://2130706433/', 'http://0x7f.1/', 'http://0.0.0.0/'])(
    'rejects IP literal %s',
    async (url) => {
      await expect(safeFetch(url, { allowPrivateHosts: false })).rejects.toThrow(UnsafeUrlError);
    },
  );

  it('rejects hostnames that resolve to any private address', async () => {
    await expect(
      safeFetch('http://mixed.test/', {
        allowPrivateHosts: false,
        lookup: async () => [
          { address: '93.184.216.34', family: 4 },
          { address: '10.0.0.5', family: 4 },
        ],
      }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects a redirect from a public host to a private address', async () => {
    const realRequest = http.request.bind(http);
    vi.spyOn(http, 'request').mockImplementation(((
      url: URL,
      options: http.RequestOptions,
      callback: (response: http.IncomingMessage) => void,
    ) =>
      realRequest(`${base}${url.pathname}`, { ...options, lookup: undefined }, callback)) as never);
    await expect(
      safeFetch('http://public.test/to-private', {
        allowPrivateHosts: false,
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      }),
    ).rejects.toThrow(/private/);
  });

  it('fails when the body exceeds maxBytes', async () => {
    await expect(safeFetch(`${base}/big`, { allowPrivateHosts: true })).rejects.toThrow(/exceeds/);
  });

  it('rejects the sixth redirect', async () => {
    await expect(safeFetch(`${base}/loop`, { allowPrivateHosts: true })).rejects.toThrow(
      /Too many redirects/,
    );
  });

  it('connects to the validated address instead of re-resolving the hostname', async () => {
    const result = await safeFetch(`http://rebind.test:${new URL(base).port}/ok`, {
      allowPrivateHosts: true,
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    });
    expect(result.status).toBe(200);
  });
});

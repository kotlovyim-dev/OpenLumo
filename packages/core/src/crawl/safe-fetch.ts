import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { isPrivateAddress } from './private-address';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

type ResolvedAddress = { address: string; family: number };

export type SafeFetchOptions = {
  allowPrivateHosts: boolean;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  lookup?: (hostname: string) => Promise<ResolvedAddress[]>;
};

export type SafeFetchResult = {
  finalUrl: string;
  status: number;
  contentType: string;
  body: Uint8Array;
};

type Hop = { status: number; headers: http.IncomingHttpHeaders; body: Uint8Array };

const defaultLookup = (hostname: string) => dnsLookup(hostname, { all: true });

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

async function resolveSafely(
  url: URL,
  options: SafeFetchOptions,
  signal: AbortSignal,
): Promise<ResolvedAddress> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`Unsupported scheme: ${url.protocol}`);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await abortable((options.lookup ?? defaultLookup)(hostname), signal);
  const [first] = addresses;
  if (!first) throw new UnsafeUrlError(`No addresses for ${hostname}`);
  if (!options.allowPrivateHosts && addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new UnsafeUrlError(`Blocked private address for ${hostname}`);
  }
  return first;
}

function requestPinned(
  url: URL,
  pinned: ResolvedAddress,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Hop> {
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: 'GET',
        signal,
        agent: false,
        headers: { 'user-agent': 'OpenLumo-Crawler', accept: 'text/html,*/*;q=0.5' },
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let total = 0;
        response.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            request.destroy(new UnsafeUrlError(`Response exceeds ${maxBytes} bytes`));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: new Uint8Array(Buffer.concat(chunks)),
          }),
        );
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end();
  });
}

export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? 2_000_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Invalid URL: ${rawUrl}`);
  }
  for (let redirects = 0; ; redirects += 1) {
    const pinned = await resolveSafely(url, options, signal);
    const hop = await requestPinned(url, pinned, maxBytes, signal);
    const location = hop.headers.location;
    if (hop.status >= 300 && hop.status < 400 && location) {
      if (redirects >= maxRedirects) throw new UnsafeUrlError('Too many redirects');
      try {
        url = new URL(location, url);
      } catch {
        throw new UnsafeUrlError(`Invalid redirect location: ${location}`);
      }
      continue;
    }
    return {
      finalUrl: url.href,
      status: hop.status,
      contentType: hop.headers['content-type'] ?? '',
      body: hop.body,
    };
  }
}

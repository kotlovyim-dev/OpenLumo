import type { Competitor } from '../brand-dna/brand-dna-schema';
import { safeFetch } from '../crawl/safe-fetch';

const VERIFY_TIMEOUT_MS = 8000;
const VERIFY_MAX_BYTES = 5_000_000;

async function isReachable(url: string, allowPrivateHosts: boolean): Promise<boolean> {
  try {
    const response = await safeFetch(url, { allowPrivateHosts, timeoutMs: VERIFY_TIMEOUT_MS, maxBytes: VERIFY_MAX_BYTES });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

export async function verifyCompetitors(
  competitors: Competitor[],
  options: { allowPrivateHosts: boolean },
): Promise<Competitor[]> {
  const reachable = await Promise.all(
    competitors.map((competitor) => competitor.url === '' || isReachable(competitor.url, options.allowPrivateHosts)),
  );
  return competitors.filter((_, index) => reachable[index]);
}

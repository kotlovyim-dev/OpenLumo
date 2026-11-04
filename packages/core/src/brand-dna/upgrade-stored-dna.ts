type StoredDna = {
  identity?: Record<string, unknown>;
  audience?: Record<string, unknown>;
  competitors?: unknown;
};

function upgradeCompetitor(competitor: unknown): unknown {
  if (typeof competitor !== 'string') return competitor;
  return { name: competitor, url: '', positioning: '', strengths: [], weaknesses: [], sourceUrls: [] };
}

export function upgradeStoredDna(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const stored = data as StoredDna;
  return {
    ...stored,
    ...(stored.identity && { identity: { features: [], ...stored.identity } }),
    ...(stored.audience && { audience: { ...stored.audience, channels: stored.audience.channels ?? [] } }),
    ...(Array.isArray(stored.competitors) && { competitors: stored.competitors.map(upgradeCompetitor) }),
  };
}

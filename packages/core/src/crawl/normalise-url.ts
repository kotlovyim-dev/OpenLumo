export function normaliseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/index\.html?$/i, '/');
  return parsed.href;
}

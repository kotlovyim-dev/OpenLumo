const IGNORED = new Set(['#000000', '#ffffff']);

function normaliseHex(hex: string): string {
  const lower = hex.toLowerCase();
  if (lower.length === 4) {
    return `#${[...lower.slice(1)].map((digit) => digit + digit).join('')}`;
  }
  return lower;
}

export function extractCssColors(css: string): string[] {
  const counts = new Map<string, number>();
  for (const [match] of css.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const color = normaliseHex(match);
    if (!IGNORED.has(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color);
}

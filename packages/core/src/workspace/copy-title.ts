export function copyTitle(copy: unknown): string | null {
  if (!copy || typeof copy !== 'object') return null;
  const fields = copy as Record<string, unknown>;
  const firstSlide = Array.isArray(fields.slides) ? (fields.slides[0] as Record<string, unknown> | undefined) : undefined;
  const title = [fields.headline, fields.subject, fields.seoTitle, firstSlide?.title, fields.caption].find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  return title ?? null;
}

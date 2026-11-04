import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { enqueue, type Queue } from '@openlumo/core';
import { contentItems, jobRuns, type Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';

export type ExportContext = { db: Database; boss: Queue; user: { id: string } };

export type ExportResult =
  | { ok: true; runId: string }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'invalid_items' };

export type ExportRunResult =
  | { ok: true; status: (typeof jobRuns.$inferSelect)['status']; resultAssetId: string | null }
  | { ok: false; error: 'not_found' };

const itemIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(200)
  .transform((ids) => [...new Set(ids)]);

const notFound = { ok: false, error: 'not_found' } as const;

export async function exportItems(context: ExportContext, brandId: string, itemIds: unknown): Promise<ExportResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return notFound;
  const parsed = itemIdsSchema.safeParse(itemIds);
  if (!parsed.success) return { ok: false, error: 'invalid_items' };
  const ids = parsed.data;

  const exportable = await context.db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.brandId, brandId),
        inArray(contentItems.id, ids),
        inArray(contentItems.status, ['approved', 'scheduled']),
      ),
    );
  if (exportable.length !== ids.length) return { ok: false, error: 'invalid_items' };

  const digest = createHash('sha256').update([...ids].sort().join(',')).digest('hex');
  const runId = await enqueue(
    context.boss,
    context.db,
    'export.bundle',
    { brandId, itemIds: ids },
    { idempotencyKey: `export:${brandId}:${digest}` },
  );
  return { ok: true, runId };
}

export async function getExportRun(context: ExportContext, brandId: string, runId: string): Promise<ExportRunResult> {
  if (!z.uuid().safeParse(runId).success) return notFound;
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'viewer'))) return notFound;
  const [run] = await context.db
    .select({ status: jobRuns.status, resultAssetId: jobRuns.resultAssetId })
    .from(jobRuns)
    .where(and(eq(jobRuns.id, runId), eq(jobRuns.brandId, brandId), eq(jobRuns.type, 'export.bundle')));
  return run ? { ok: true, ...run } : notFound;
}

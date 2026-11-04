import { z } from 'zod';
import {
  addDnaFeedback,
  brandDnaSchema,
  enqueue,
  findBrand,
  getBrandDna,
  getResearch,
  normalisePalette,
  saveBrandDna,
  setBrandName,
  setBrandStatus,
  type Queue,
} from '@openlumo/core';
import type { Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';
import { toFieldErrors, type FieldErrors } from '../../lib/field-errors';

export type DnaContext = { db: Database; boss: Queue; user: { id: string } };

export type DnaResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'not_found' | 'invalid_input'; fieldErrors?: FieldErrors };

const noteSchema = z.string().trim().min(1).max(2000);

export async function updateBrandDna(context: DnaContext, brandId: string, dna: unknown): Promise<DnaResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const parsed = brandDnaSchema.safeParse(dna);
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: toFieldErrors(parsed.error) };
  const brand = await findBrand(context.db, brandId);
  if (!brand) return { ok: false, error: 'not_found' };
  const stored = await getBrandDna(context.db, brandId);
  await saveBrandDna(context.db, brandId, {
    ...parsed.data,
    visuals: {
      ...parsed.data.visuals,
      palette: normalisePalette(parsed.data.visuals.palette),
      logoAssetId: stored?.dna.visuals.logoAssetId,
    },
  });
  const name = parsed.data.identity.name.trim();
  if (name && name !== brand.name) await setBrandName(context.db, brandId, name);
  if (brand.status === 'needs_input') await setBrandStatus(context.db, brandId, 'ready');
  return { ok: true };
}

export async function addFeedback(context: DnaContext, brandId: string, note: string): Promise<DnaResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: { note: 'Write a note up to 2000 characters.' } };
  await addDnaFeedback(context.db, brandId, parsed.data);
  return { ok: true };
}

export async function requestResearchRefresh(context: DnaContext, brandId: string): Promise<DnaResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const brand = await findBrand(context.db, brandId);
  if (!brand) return { ok: false, error: 'not_found' };
  if (!brand.url) return { ok: false, error: 'invalid_input' };
  const research = await getResearch(context.db, brandId);
  await enqueue(
    context.boss,
    context.db,
    'brand.research',
    { brandId, refresh: true },
    { idempotencyKey: `research-refresh:${brandId}:${research?.attemptedAt.toISOString() ?? 'never'}` },
  );
  return { ok: true };
}

export async function requestFeedbackMerge(context: DnaContext, brandId: string): Promise<DnaResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const saved = await getBrandDna(context.db, brandId);
  if (!saved) return { ok: false, error: 'not_found' };
  await enqueue(
    context.boss,
    context.db,
    'brand.synthesize-dna',
    { brandId, mergeFeedback: true },
    { idempotencyKey: `merge-feedback:${brandId}:${saved.version}` },
  );
  return { ok: true };
}

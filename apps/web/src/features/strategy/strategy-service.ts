import { z } from 'zod';
import { DAY_MS, channelSchema, enqueue, findLatestPlannedAt, goalSchema, type Queue } from '@openlumo/core';
import type { Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';
import { toFieldErrors, type FieldErrors } from '../../lib/field-errors';

export type StrategyContext = { db: Database; boss: Queue; user: { id: string } };

export type StrategyResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'already_planned'; fieldErrors?: FieldErrors };

const createStrategySchema = z.object({
  goal: goalSchema,
  channels: z.array(channelSchema).min(1, 'Pick at least one channel.'),
});

export async function createStrategyForBrand(
  context: StrategyContext,
  brandId: string,
  goal: unknown,
  channels: unknown,
): Promise<StrategyResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const parsed = createStrategySchema.safeParse({ goal, channels });
  if (!parsed.success) return { ok: false, error: 'invalid_input', fieldErrors: toFieldErrors(parsed.error) };
  await enqueue(context.boss, context.db, 'strategy.create', { brandId, ...parsed.data });
  return { ok: true };
}

const COVERED_DAYS = 14;

export async function planMore(context: StrategyContext, brandId: string, now = new Date()): Promise<StrategyResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const latestPlannedAt = await findLatestPlannedAt(context.db, brandId);
  const coverageEnd = Math.max(now.getTime(), latestPlannedAt?.getTime() ?? 0);
  if (Math.round((now.getTime() + COVERED_DAYS * DAY_MS - coverageEnd) / DAY_MS) <= 0) {
    return { ok: false, error: 'already_planned' };
  }
  await enqueue(
    context.boss,
    context.db,
    'plan.top-up',
    { brandId },
    { idempotencyKey: `top-up:${brandId}:${new Date(coverageEnd).toISOString().slice(0, 10)}` },
  );
  return { ok: true };
}

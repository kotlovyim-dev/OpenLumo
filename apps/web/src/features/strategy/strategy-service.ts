import { z } from 'zod';
import { channelSchema, enqueue, goalSchema, type Queue } from '@openlumo/core';
import type { Database } from '@openlumo/db';
import { findBrandAccess } from '../brands/brand-access';
import { toFieldErrors, type FieldErrors } from '../brand-dna/dna-service';

export type StrategyContext = { db: Database; boss: Queue; user: { id: string } };

export type StrategyResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input'; fieldErrors?: FieldErrors };

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

export async function planMore(context: StrategyContext, brandId: string, now = new Date()): Promise<StrategyResult> {
  if (!(await findBrandAccess(context.db, context.user.id, brandId, 'editor'))) return { ok: false, error: 'forbidden' };
  const todayUtcDate = now.toISOString().slice(0, 10);
  await enqueue(
    context.boss,
    context.db,
    'plan.top-up',
    { brandId },
    { idempotencyKey: `top-up:${brandId}:${todayUtcDate}` },
  );
  return { ok: true };
}

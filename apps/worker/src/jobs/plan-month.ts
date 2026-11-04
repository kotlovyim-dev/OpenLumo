import {
  BrandNotReadyError,
  DAY_MS,
  defineJob,
  findStrategy,
  getBrandDna,
  insertSuggestedItems,
  listBrandSlotsInWindow,
  listStrategyItemsInWindow,
  planContent,
  resolveModels,
  strategyDocumentSchema,
} from '@openlumo/core';
import type { WorkerDependencies } from '../worker-dependencies';

export function createPlanMonthJob({ db, config }: WorkerDependencies) {
  return defineJob('plan.month', async ({ brandId, strategyId, from, days }, context) => {
    await context.reportProgress('Planning your content');

    const saved = await getBrandDna(db, brandId);
    if (!saved) throw new BrandNotReadyError(brandId);
    const strategy = await findStrategy(db, strategyId);
    if (!strategy) throw new Error(`Strategy ${strategyId} not found`);

    const start = new Date(from);
    const end = new Date(start.getTime() + days * DAY_MS);

    const planned = await listStrategyItemsInWindow(db, strategyId, start, end);
    if (planned.length > 0) {
      for (const item of planned.filter((item) => item.status === 'suggested' && !item.currentVersionId)) {
        await context.enqueue(
          'item.generate',
          { brandId, itemId: item.id, targetVersion: 1 },
          { idempotencyKey: `generate:${item.id}:1` },
        );
      }
      return;
    }
    const existing = await listBrandSlotsInWindow(db, brandId, start, end);

    const { brain } = await resolveModels(db, config);
    const { slots, usage } = await planContent(brain.model, brain.modelId, {
      dna: saved.dna,
      strategy: strategyDocumentSchema.parse(strategy.document),
      from: start,
      days,
      existing,
    });
    await context.recordUsage(usage);
    if (slots.length === 0) return;

    for (const itemId of await insertSuggestedItems(db, brandId, strategyId, slots)) {
      await context.enqueue(
        'item.generate',
        { brandId, itemId, targetVersion: 1 },
        { idempotencyKey: `generate:${itemId}:1` },
      );
    }
  });
}

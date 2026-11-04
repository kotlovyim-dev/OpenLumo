import {
  BrandNotReadyError,
  createStrategy,
  defineJob,
  getBrandDna,
  insertStrategy,
  resolveModels,
} from '@openlumo/core';
import type { WorkerDependencies } from '../worker-dependencies';

const PLAN_DAYS = 30;

export function createStrategyCreateJob({ db, config, boss }: WorkerDependencies) {
  return defineJob('strategy.create', async ({ brandId, goal, channels }, context) => {
    await context.reportProgress('dna');

    const saved = await getBrandDna(db, brandId);
    if (!saved) throw new BrandNotReadyError(brandId);

    const { brain } = await resolveModels(db, config);
    let reported = Promise.resolve();
    const { document, usage } = await createStrategy(
      brain.model,
      brain.modelId,
      { dna: saved.dna, goal, channels },
      (section) => {
        reported = reported.then(() => context.reportProgress(section));
      },
    );
    await reported;
    await context.recordUsage(usage);

    const strategy = await insertStrategy(db, { brandId, goal, channels, document });
    await boss.schedule('plan.top-up', '0 6 * * 1', { brandId }, { key: brandId });
    await context.enqueue(
      'plan.month',
      { brandId, strategyId: strategy.id, from: new Date().toISOString(), days: PLAN_DAYS },
      { idempotencyKey: `plan-month:${strategy.id}` },
    );
  });
}

import type { JobDefinition } from '@openlumo/core';
import { createBrandCrawlJob } from './jobs/brand-crawl';
import { createBrandSynthesizeDnaJob } from './jobs/brand-synthesize-dna';
import { createChatReplyJob } from './jobs/chat-reply';
import { createExportBundleJob } from './jobs/export-bundle';
import { createItemGenerateJob } from './jobs/item-generate';
import { createItemRegenerateJob } from './jobs/item-regenerate';
import { createPlanMonthJob } from './jobs/plan-month';
import { createPlanTopUpJob } from './jobs/plan-top-up';
import { createStrategyCreateJob } from './jobs/strategy-create';
import type { WorkerDependencies } from './worker-dependencies';

export function createJobDefinitions(deps: WorkerDependencies): JobDefinition[] {
  return [
    createBrandCrawlJob(deps),
    createBrandSynthesizeDnaJob(deps),
    createStrategyCreateJob(deps),
    createPlanMonthJob(deps),
    createPlanTopUpJob(deps),
    createItemGenerateJob(deps),
    createItemRegenerateJob(deps),
    createExportBundleJob(deps),
    createChatReplyJob(deps),
  ] as JobDefinition[];
}

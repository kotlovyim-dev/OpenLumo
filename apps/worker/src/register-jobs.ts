import type { JobDefinition } from '@openlumo/core';
import { createBrandCrawlJob } from './jobs/brand-crawl';
import { createBrandSynthesizeDnaJob } from './jobs/brand-synthesize-dna';
import type { WorkerDependencies } from './worker-dependencies';

export function createJobDefinitions(deps: WorkerDependencies): JobDefinition[] {
  return [createBrandCrawlJob(deps), createBrandSynthesizeDnaJob(deps)] as JobDefinition[];
}

import { integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { brands } from './brands';
import { contentItems } from './content';

export const jobStatus = pgEnum('job_status', ['queued', 'running', 'succeeded', 'failed']);

export const jobRuns = pgTable('job_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: text('job_id'),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').references(() => contentItems.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: jobStatus('status').notNull().default('queued'),
  progress: integer('progress').notNull().default(0),
  step: text('step'),
  error: text('error'),
  errorCode: text('error_code'),
  costUsd: numeric('cost_usd', { precision: 12, scale: 6, mode: 'number' }).notNull().default(0),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { brands } from './brands';

export const itemStatus = pgEnum('item_status', ['suggested', 'in_review', 'approved', 'scheduled', 'exported', 'rejected']);
export const itemFormat = pgEnum('item_format', ['social_post', 'carousel', 'static_ad', 'email', 'blog_post']);
export const channel = pgEnum('channel', ['instagram', 'linkedin', 'x', 'tiktok', 'facebook', 'email', 'blog']);

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  goal: text('goal').notNull(),
  channels: channel('channels').array().notNull(),
  document: jsonb('document').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contentItems = pgTable('content_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  channel: channel('channel').notNull(),
  format: itemFormat('format').notNull(),
  pillar: text('pillar'),
  angle: text('angle'),
  status: itemStatus('status').notNull().default('suggested'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  currentVersionId: uuid('current_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const itemVersions = pgTable(
  'item_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    copy: jsonb('copy').notNull(),
    imageBrief: text('image_brief'),
    assetIds: uuid('asset_ids').array().notNull().default([]),
    feedback: text('feedback'),
    author: text('author', { enum: ['user', 'planner', 'chat'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('item_versions_item_id_number_idx').on(table.itemId, table.number)],
);

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['image', 'logo', 'export'] }).notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  width: integer('width'),
  height: integer('height'),
  provider: text('provider'),
  model: text('model'),
  prompt: text('prompt'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

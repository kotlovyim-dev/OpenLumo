import { boolean, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const brandStatus = pgEnum('brand_status', ['crawling', 'needs_input', 'ready', 'failed']);
export const memberRole = pgEnum('member_role', ['owner', 'editor', 'viewer']);

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url'),
  status: brandStatus('status').notNull().default('crawling'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const brandMembers = pgTable(
  'brand_members',
  {
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull(),
  },
  (table) => [primaryKey({ columns: [table.brandId, table.userId] })],
);

export const brandDna = pgTable('brand_dna', {
  brandId: uuid('brand_id')
    .primaryKey()
    .references(() => brands.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const brandSources = pgTable('brand_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  kind: text('kind', { enum: ['page', 'image', 'logo'] }).notNull(),
  text: text('text'),
  meta: jsonb('meta'),
});

export const dnaFeedback = pgTable('dna_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id'),
  note: text('note').notNull(),
  merged: boolean('merged').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

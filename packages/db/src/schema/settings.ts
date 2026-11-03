import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

export const capability = pgEnum('capability', ['brain', 'image', 'video', 'audio']);

export const modelSettings = pgTable('model_settings', {
  capability: capability('capability').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  params: jsonb('params'),
});

export const secrets = pgTable('secrets', {
  name: text('name').primaryKey(),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
});

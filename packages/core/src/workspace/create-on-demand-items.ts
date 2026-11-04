import { contentItems, type Database } from '@openlumo/db';
import { enqueue, type Queue } from '../jobs/queue';
import type { Channel, ItemFormat } from '../planner/channel-formats';

export type OnDemandRequest = {
  brandId: string;
  channel: Channel;
  format: ItemFormat;
  instruction?: string;
  variants: number;
};

export async function createOnDemandItems(
  db: Database,
  boss: Queue,
  { brandId, channel, format, instruction, variants }: OnDemandRequest,
): Promise<string[]> {
  const items = await db
    .insert(contentItems)
    .values(Array.from({ length: variants }, () => ({ brandId, channel, format, status: 'in_review' as const })))
    .returning({ id: contentItems.id });
  const itemIds = items.map((item) => item.id);
  for (const itemId of itemIds) {
    await enqueue(
      boss,
      db,
      'item.generate',
      { brandId, itemId, targetVersion: 1, instruction },
      { idempotencyKey: `generate:${itemId}:1` },
    );
  }
  return itemIds;
}

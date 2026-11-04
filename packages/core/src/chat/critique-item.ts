import type { Channel, ItemFormat } from '../planner/channel-formats';
import { wrapUntrustedContent } from '../prompts/untrusted-content';
import { copyRules } from '../studio/studio-prompts';
import type { ItemStatus } from '../workspace/item-status';

export type CritiquedItem = { id: string; channel: Channel; format: ItemFormat; status: ItemStatus };

export function describeItemForCritique(item: CritiquedItem, copy: unknown): string {
  return [
    `Item ${item.id} is a ${item.format} for ${item.channel} with status ${item.status}.`,
    `Current copy:\n${wrapUntrustedContent('item_copy', JSON.stringify(copy))}`,
    `Checklist:\n${copyRules(item.channel, item.format)}`,
  ].join('\n\n');
}

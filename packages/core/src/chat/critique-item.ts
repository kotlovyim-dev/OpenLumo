import { itemText } from '../export/build-export-bundle';
import type { Channel, ItemFormat } from '../planner/channel-formats';
import { wrapUntrustedContent } from '../prompts/untrusted-content';
import { findBannedPhrases } from '../prompts/writing-rules';
import type { FormatCopy } from '../studio/format-schemas';
import { copyRules } from '../studio/studio-prompts';
import type { ItemStatus } from '../workspace/item-status';

export type CritiquedItem = { id: string; channel: Channel; format: ItemFormat; status: ItemStatus };

export function describeItemForCritique(item: CritiquedItem, copy: FormatCopy): string {
  const banned = findBannedPhrases(itemText(item.format, copy));
  return [
    `Item ${item.id} is a ${item.format} for ${item.channel} with status ${item.status}.`,
    `Current copy:\n${wrapUntrustedContent('item_copy', JSON.stringify(copy))}`,
    `Banned words and phrases found: ${banned.length > 0 ? banned.map((entry) => `"${entry}"`).join(', ') : 'none'}.`,
    `Checklist:\n${copyRules(item.channel, item.format)}`,
  ].join('\n\n');
}

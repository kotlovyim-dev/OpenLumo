import { itemText } from '../export/build-export-bundle';
import type { Channel, ItemFormat } from '../planner/channel-formats';
import { wrapUntrustedContent } from '../prompts/untrusted-content';
import type { FormatCopy } from '../studio/format-schemas';

const SOURCE_TEXT_LIMIT = 1500;

export function buildRepurposeInstruction(
  source: { channel: Channel; format: ItemFormat; copy: FormatCopy },
  target: { channel: Channel; format: ItemFormat; angle?: string },
): string {
  const sourceText = itemText(source.format, source.copy).slice(0, SOURCE_TEXT_LIMIT);
  return [
    `Repurpose the ${source.format} from ${source.channel} below into a native ${target.format} for ${target.channel}. Keep its core idea and facts, rebuild the hook, structure and length for ${target.channel}, and never copy its sentences word for word.`,
    ...(target.angle ? [`Angle: ${target.angle}`] : []),
    wrapUntrustedContent('source_item', sourceText),
  ].join('\n');
}

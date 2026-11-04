import { DAY_MS } from '../time';
import { generateObject, type LanguageModel, type Usage } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import { channelFormats } from './channel-formats';
import { type PlannedSlot, plannedSlotsSchema } from './plan-schema';
import { buildPlanMessages } from './planner-prompts';
import type { StrategyDocument } from './strategy-schema';

const DEFAULT_TIME = '09:00';

export async function planContent(
  brain: LanguageModel,
  modelId: string,
  input: { dna: BrandDna; strategy: StrategyDocument; from: Date; days: number; existing: PlannedSlot[] },
): Promise<{ slots: PlannedSlot[]; usage: Usage }> {
  const { value, usage } = await generateObject(brain, {
    model: modelId,
    messages: buildPlanMessages(input),
    schema: plannedSlotsSchema,
    schemaName: 'content_plan',
  });
  const start = input.from.getTime();
  const end = start + input.days * DAY_MS;
  const slots = value.slots
    .map(({ date, time, ...slot }) => ({
      ...slot,
      scheduledAt: new Date(`${date}T${time ?? DEFAULT_TIME}:00Z`),
    }))
    .filter(
      (slot) =>
        channelFormats[slot.channel].includes(slot.format) &&
        slot.scheduledAt.getTime() >= start &&
        slot.scheduledAt.getTime() < end,
    );
  return { slots, usage };
}

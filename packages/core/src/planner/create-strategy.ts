import { generateObject, type LanguageModel, type Usage } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { Channel } from './channel-formats';
import { buildStrategyMessages } from './planner-prompts';
import { type Goal, type StrategyDocument, strategyDocumentSchema } from './strategy-schema';

export async function createStrategy(
  brain: LanguageModel,
  modelId: string,
  input: { dna: BrandDna; goal: Goal; channels: Channel[] },
): Promise<{ document: StrategyDocument; usage: Usage }> {
  const { value, usage } = await generateObject(brain, {
    model: modelId,
    messages: buildStrategyMessages(input.dna, input.goal, input.channels),
    schema: strategyDocumentSchema,
    schemaName: 'strategy',
  });
  return { document: value, usage };
}

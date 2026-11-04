import { generateObject, type LanguageModel, type Usage } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { Channel } from './channel-formats';
import { buildStrategyMessages } from './planner-prompts';
import { type Goal, type StrategyDocument, strategyDocumentSchema } from './strategy-schema';

export const strategySections = ['strengths', 'gaps', 'pillars', 'cadence', 'campaignIdeas'] as const;

export type StrategySection = (typeof strategySections)[number];

const sectionKeys = strategySections.map((section) => new RegExp(`"${section}"\\s*:`));

function followSections(onSection: (section: StrategySection) => void) {
  let reached = 0;
  onSection(strategySections[0]);
  return (textSoFar: string) => {
    while (reached + 1 < strategySections.length && sectionKeys[reached + 1]!.test(textSoFar)) {
      reached += 1;
      onSection(strategySections[reached]!);
    }
  };
}

export async function createStrategy(
  brain: LanguageModel,
  modelId: string,
  input: { dna: BrandDna; goal: Goal; channels: Channel[] },
  onSection?: (section: StrategySection) => void,
): Promise<{ document: StrategyDocument; usage: Usage }> {
  const { value, usage } = await generateObject(brain, {
    model: modelId,
    messages: buildStrategyMessages(input.dna, input.goal, input.channels),
    schema: strategyDocumentSchema,
    schemaName: 'strategy',
    ...(onSection && { onText: followSections(onSection) }),
  });
  return { document: value, usage };
}

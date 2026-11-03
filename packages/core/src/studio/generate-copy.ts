import { generateObject, type LanguageModel, type Usage } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import { type FormatCopy, formatCopySchemas } from './format-schemas';
import { buildCopyMessages, type CopyInput } from './studio-prompts';

const DEFAULT_LANGUAGE = 'en';

export function copyLanguage(dna: BrandDna): string {
  return dna.languages[0] ?? DEFAULT_LANGUAGE;
}

export async function generateCopy(
  brain: LanguageModel,
  modelId: string,
  input: CopyInput,
): Promise<{ copy: FormatCopy; usage: Usage }> {
  const { value, usage } = await generateObject(brain, {
    model: modelId,
    messages: buildCopyMessages(input),
    schema: formatCopySchemas[input.item.format],
    schemaName: `copy_${input.item.format}`,
  });
  return { copy: value, usage };
}

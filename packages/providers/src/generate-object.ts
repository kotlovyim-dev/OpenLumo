import { z } from 'zod';
import { ProviderError } from './provider-error';
import type { LanguageModel, TextRequest, Usage } from './types';

type GenerateObjectRequest<T> = Omit<TextRequest, 'jsonSchema'> & {
  schema: z.ZodType<T>;
  schemaName: string;
};

function stripCodeFence(text: string): string {
  const match = /^\s*```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```\s*$/.exec(text);
  return (match?.[1] ?? text).trim();
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

function parseAgainst<T>(schema: z.ZodType<T>, text: string): { value: T } | { problem: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(text));
  } catch (error) {
    return { problem: `The response was not valid JSON: ${(error as Error).message}` };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { value: parsed.data };
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  return { problem: `The response did not match the schema:\n${issues}` };
}

export async function generateObject<T>(
  model: LanguageModel,
  { schema, schemaName, ...request }: GenerateObjectRequest<T>,
): Promise<{ value: T; usage: Usage }> {
  const jsonSchema = { name: schemaName, schema: z.toJSONSchema(schema) };
  const first = await model.complete({ ...request, jsonSchema });
  const firstParse = parseAgainst(schema, first.text);
  if ('value' in firstParse) return { value: firstParse.value, usage: first.usage };

  const second = await model.complete({
    ...request,
    jsonSchema,
    messages: [
      ...request.messages,
      { role: 'assistant', content: first.text },
      {
        role: 'user',
        content: `${firstParse.problem}\nReply again with only the corrected JSON.`,
      },
    ],
  });
  const secondParse = parseAgainst(schema, second.text);
  if ('value' in secondParse) {
    return { value: secondParse.value, usage: addUsage(first.usage, second.usage) };
  }
  throw new ProviderError('invalid_output', secondParse.problem);
}

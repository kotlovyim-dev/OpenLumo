import { z } from 'zod';
import type { ToolCall, ToolDefinition } from '@openlumo/providers';
import { channelFormats, channelSchema, itemFormatSchema, type Channel, type ItemFormat } from '../planner/channel-formats';

const MAX_TOOL_TEXT_LENGTH = 1000;

const toolText = z.string().trim().min(1).max(MAX_TOOL_TEXT_LENGTH);

const createDraftShape = z.object({ channel: channelSchema, format: itemFormatSchema, angle: toolText });

const regenerateItemShape = z.object({
  itemId: z.uuid(),
  scope: z.enum(['copy', 'image', 'all']),
  feedback: toolText,
});

const critiqueItemShape = z.object({ itemId: z.uuid() });

const repurposeItemShape = z.object({
  itemId: z.uuid(),
  channel: channelSchema,
  format: itemFormatSchema,
  angle: toolText.optional(),
});

function supportsFormat({ channel, format }: { channel: Channel; format: ItemFormat }): boolean {
  return channelFormats[channel].includes(format);
}

const unsupportedFormat = { path: ['format'], message: 'This channel does not support that format.' };

const createDraftArguments = createDraftShape.refine(supportsFormat, unsupportedFormat);
const repurposeItemArguments = repurposeItemShape.refine(supportsFormat, unsupportedFormat);

export type CreateDraftArguments = z.infer<typeof createDraftShape>;
export type RegenerateItemArguments = z.infer<typeof regenerateItemShape>;
export type CritiqueItemArguments = z.infer<typeof critiqueItemShape>;
export type RepurposeItemArguments = z.infer<typeof repurposeItemShape>;

export type ToolOutcome = { result: string; itemId?: string };

export type ChatToolHandlers = {
  create_draft(args: CreateDraftArguments): Promise<ToolOutcome>;
  regenerate_item(args: RegenerateItemArguments): Promise<ToolOutcome>;
  critique_item(args: CritiqueItemArguments): Promise<ToolOutcome>;
  repurpose_item(args: RepurposeItemArguments): Promise<ToolOutcome>;
};

export const chatTools: ToolDefinition[] = [
  {
    name: 'create_draft',
    description:
      'Start a new draft content item for the brand. It lands on the board in review and is written in the background.',
    parameters: z.toJSONSchema(createDraftShape),
  },
  {
    name: 'regenerate_item',
    description:
      'Regenerate an existing content item of the brand by its id, rewriting its copy, its image or both according to the feedback.',
    parameters: z.toJSONSchema(regenerateItemShape),
  },
  {
    name: 'critique_item',
    description:
      'Read an existing content item of the brand by its id: its channel, format, status, current copy and the checklist for its channel and format. Changes nothing.',
    parameters: z.toJSONSchema(critiqueItemShape),
  },
  {
    name: 'repurpose_item',
    description:
      'Turn an existing content item of the brand into a new draft for a channel and format, rewritten natively for that platform. It lands on the board in review and is written in the background.',
    parameters: z.toJSONSchema(repurposeItemShape),
  },
];

function invalidArguments(name: string, error: z.ZodError): ToolOutcome {
  const issues = error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
  return { result: `Invalid arguments for ${name}: ${issues}` };
}

function run<Arguments>(
  call: ToolCall,
  schema: z.ZodType<Arguments>,
  handler: (args: Arguments) => Promise<ToolOutcome>,
): Promise<ToolOutcome> {
  const parsed = schema.safeParse(call.arguments);
  return parsed.success ? handler(parsed.data) : Promise.resolve(invalidArguments(call.name, parsed.error));
}

export function createChatToolExecutor(handlers: ChatToolHandlers): (call: ToolCall) => Promise<ToolOutcome> {
  return async (call) => {
    switch (call.name) {
      case 'create_draft':
        return run(call, createDraftArguments, handlers.create_draft);
      case 'regenerate_item':
        return run(call, regenerateItemShape, handlers.regenerate_item);
      case 'critique_item':
        return run(call, critiqueItemShape, handlers.critique_item);
      case 'repurpose_item':
        return run(call, repurposeItemArguments, handlers.repurpose_item);
      default:
        return { result: `Unknown tool ${call.name}.` };
    }
  };
}

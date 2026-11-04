import { z } from 'zod';
import type { ToolCall, ToolDefinition } from '@openlumo/providers';
import { channelFormats, channelSchema, itemFormatSchema } from '../planner/channel-formats';

const MAX_TOOL_TEXT_LENGTH = 1000;

const toolText = z.string().trim().min(1).max(MAX_TOOL_TEXT_LENGTH);

const createDraftShape = z.object({ channel: channelSchema, format: itemFormatSchema, angle: toolText });

const regenerateItemShape = z.object({
  itemId: z.uuid(),
  scope: z.enum(['copy', 'image', 'all']),
  feedback: toolText,
});

const createDraftArguments = createDraftShape.refine(({ channel, format }) => channelFormats[channel].includes(format), {
  path: ['format'],
  message: 'This channel does not support that format.',
});

export type CreateDraftArguments = z.infer<typeof createDraftShape>;
export type RegenerateItemArguments = z.infer<typeof regenerateItemShape>;

export type ToolOutcome = { result: string; itemId?: string };

export type ChatToolHandlers = {
  create_draft(args: CreateDraftArguments): Promise<ToolOutcome>;
  regenerate_item(args: RegenerateItemArguments): Promise<ToolOutcome>;
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
];

function invalidArguments(name: string, error: z.ZodError): ToolOutcome {
  const issues = error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
  return { result: `Invalid arguments for ${name}: ${issues}` };
}

export function createChatToolExecutor(handlers: ChatToolHandlers): (call: ToolCall) => Promise<ToolOutcome> {
  return async (call) => {
    if (call.name === 'create_draft') {
      const parsed = createDraftArguments.safeParse(call.arguments);
      return parsed.success ? handlers.create_draft(parsed.data) : invalidArguments(call.name, parsed.error);
    }
    if (call.name === 'regenerate_item') {
      const parsed = regenerateItemShape.safeParse(call.arguments);
      return parsed.success ? handlers.regenerate_item(parsed.data) : invalidArguments(call.name, parsed.error);
    }
    return { result: `Unknown tool ${call.name}.` };
  };
}

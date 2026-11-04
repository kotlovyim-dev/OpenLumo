import { ProviderError } from '../provider-error';
import type { LanguageModel, Message, TextRequest, TextResult, ToolCall } from '../types';
import type { OpenRouterClient } from './openrouter-client';
import { readUsage, type WireUsage } from './usage';

type WireToolCall = { id: string; function: { name: string; arguments: string } };

type ChatResponse = {
  choices?: { message?: { content?: string | null; tool_calls?: WireToolCall[] } }[];
  usage?: WireUsage;
};

function toWireToolCall(call: ToolCall) {
  return { id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } };
}

function toWireMessage({ toolCallId, toolCalls, ...rest }: Message) {
  return {
    ...rest,
    ...(toolCallId !== undefined && { tool_call_id: toolCallId }),
    ...(toolCalls !== undefined && { tool_calls: toolCalls.map(toWireToolCall) }),
  };
}

function parseToolCall(raw: WireToolCall): ToolCall {
  try {
    return { id: raw.id, name: raw.function.name, arguments: JSON.parse(raw.function.arguments) };
  } catch {
    throw new ProviderError('invalid_output', `Invalid arguments for tool ${raw.function.name}`);
  }
}

export function createOpenRouterLanguageModel(client: OpenRouterClient): LanguageModel {
  return {
    async complete(request: TextRequest): Promise<TextResult> {
      const body: Record<string, unknown> = {
        model: request.model,
        messages: request.messages.map(toWireMessage),
      };
      if (request.jsonSchema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: { ...request.jsonSchema, strict: true },
        };
      }
      if (request.tools) {
        body.tools = request.tools.map((tool) => ({ type: 'function', function: tool }));
      }
      const response = await client.post<ChatResponse>('/chat/completions', body, request.signal);
      const message = response.choices?.[0]?.message;
      if (!message) throw new ProviderError('invalid_output', 'Response has no message');
      return {
        text: message.content ?? '',
        toolCalls: (message.tool_calls ?? []).map(parseToolCall),
        usage: readUsage(response.usage),
      };
    },
  };
}

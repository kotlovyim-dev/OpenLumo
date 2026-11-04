import { ProviderError } from '../provider-error';
import type { Citation, LanguageModel, Message, TextRequest, TextResult, ToolCall } from '../types';
import type { OpenRouterClient } from './openrouter-client';
import { readUsage, type WireUsage } from './usage';

type WireToolCall = { id: string; function: { name: string; arguments: string } };

type WireAnnotation = { type?: string; url_citation?: { url?: string; title?: string } };

type ChatResponse = {
  choices?: {
    message?: { content?: string | null; tool_calls?: WireToolCall[]; annotations?: WireAnnotation[] };
  }[];
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

function isWebAddress(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function readCitations(annotations: WireAnnotation[]): Citation[] {
  const citations = new Map<string, Citation>();
  for (const annotation of annotations) {
    const url = annotation.type === 'url_citation' ? annotation.url_citation?.url : undefined;
    if (!url || !isWebAddress(url) || citations.has(url)) continue;
    citations.set(url, { url, title: annotation.url_citation?.title ?? '' });
  }
  return [...citations.values()];
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
      if (request.webSearch) {
        body.plugins = [{ id: 'web', max_results: request.webSearch.maxResults }];
      }
      const response = await client.post<ChatResponse>('/chat/completions', body, request.signal);
      const message = response.choices?.[0]?.message;
      if (!message) throw new ProviderError('invalid_output', 'Response has no message');
      return {
        text: message.content ?? '',
        toolCalls: (message.tool_calls ?? []).map(parseToolCall),
        usage: readUsage(response.usage),
        ...(message.annotations && { citations: readCitations(message.annotations) }),
      };
    },
  };
}

import { ProviderError } from '../provider-error';
import type { Citation, LanguageModel, Message, TextRequest, TextResult, ToolCall } from '../types';
import type { OpenRouterClient } from './openrouter-client';
import { errorFromResponse } from './error-mapping';
import { readUsage, type WireUsage } from './usage';

type WireToolCall = { id: string; function: { name: string; arguments: string } };

type WireAnnotation = { type?: string; url_citation?: { url?: string; title?: string } };

type ChatResponse = {
  choices?: {
    message?: { content?: string | null; tool_calls?: WireToolCall[]; annotations?: WireAnnotation[] };
  }[];
  usage?: WireUsage;
};

type ChatChunk = {
  choices?: { delta?: { content?: string | null; annotations?: WireAnnotation[] } }[];
  usage?: WireUsage;
  error?: { code?: number; message?: string };
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

async function streamCompletion(
  client: OpenRouterClient,
  body: Record<string, unknown>,
  onText: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<TextResult> {
  let text = '';
  let usage: WireUsage | undefined;
  const annotations: WireAnnotation[] = [];
  await client.stream(
    '/chat/completions',
    body,
    (data) => {
      const chunk = data as ChatChunk;
      if (chunk.error) throw errorFromResponse(chunk.error.code ?? 500, chunk.error.message ?? 'Stream failed');
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.annotations) annotations.push(...delta.annotations);
      if (chunk.usage) usage = chunk.usage;
      if (!delta?.content) return;
      text += delta.content;
      onText(text);
    },
    signal,
  );
  return {
    text,
    toolCalls: [],
    usage: readUsage(usage),
    ...(annotations.length > 0 && { citations: readCitations(annotations) }),
  };
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
      if (request.onText && !request.tools) return streamCompletion(client, body, request.onText, request.signal);
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

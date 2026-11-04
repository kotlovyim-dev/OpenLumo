import { addUsage, type LanguageModel, type Message, type ToolCall, type Usage } from '@openlumo/providers';
import type { BrandDna } from '../brand-dna/brand-dna-schema';
import type { Channel, ItemFormat } from '../planner/channel-formats';
import type { StrategyDocument } from '../planner/strategy-schema';
import type { ItemStatus } from '../workspace/item-status';
import { buildChatSystemPrompt } from './chat-prompts';
import { chatTools } from './chat-tools';

export type ChatItem = { id: string; channel: Channel; format: ItemFormat; status: ItemStatus; title: string | null };

export type ChatContext = {
  dna: BrandDna;
  strategy?: { goal: string; pillars: StrategyDocument['pillars'] };
  recentItems: ChatItem[];
  history: Message[];
};

const MAX_TOOL_ROUNDS = 3;
const stoppedReply = 'I stopped after three actions.';

export async function replyToChat(
  brain: LanguageModel,
  modelId: string,
  context: ChatContext,
  executeTool: (call: ToolCall) => Promise<string>,
): Promise<{ reply: string; usage: Usage }> {
  let messages: Message[] = [{ role: 'system', content: buildChatSystemPrompt(context) }, ...context.history];
  let usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (let round = 1; ; round += 1) {
    const result = await brain.complete({ model: modelId, messages, tools: chatTools });
    usage = addUsage(usage, result.usage);
    if (result.toolCalls.length === 0) return { reply: result.text, usage };
    if (round > MAX_TOOL_ROUNDS) return { reply: result.text.trim() || stoppedReply, usage };
    const toolMessages: Message[] = [];
    for (const call of result.toolCalls) {
      toolMessages.push({ role: 'tool', toolCallId: call.id, content: await executeTool(call) });
    }
    messages = [...messages, { role: 'assistant', content: result.text, toolCalls: result.toolCalls }, ...toolMessages];
  }
}

import { describe, expect, it, vi } from 'vitest';
import { FakeProvider, ProviderError, type TextRequest, type TextResult, type ToolCall, type Usage } from '@openlumo/providers';
import { createPartialBrandDna } from '../../src/brand-dna/brand-dna-schema';
import { chatTools, createChatToolExecutor } from '../../src/chat/chat-tools';
import { replyToChat, type ChatContext } from '../../src/chat/reply-to-chat';

const itemId = '6f1c2b8e-7f53-4d7a-9a3e-2f1d0c9b8a71';

const context: ChatContext = {
  dna: createPartialBrandDna({ name: 'Acme', palette: [] }),
  strategy: { goal: 'launch', pillars: [{ name: 'Craft', description: 'How we make it.' }] },
  recentItems: [{ id: itemId, channel: 'instagram', format: 'social_post', status: 'in_review', title: 'Fresh bread' }],
  history: [{ role: 'user', content: 'Draft an Instagram post about our launch.' }],
};

const usage = { inputTokens: 10, outputTokens: 2, costUsd: 0.001 };

function toolResult(calls: ToolCall[]): TextResult {
  return { text: '', toolCalls: calls, usage };
}

function draftCall(id: string, args: unknown = { channel: 'instagram', format: 'social_post', angle: 'Launch day' }) {
  return { id, name: 'create_draft', arguments: args };
}

function toolMessages(request: TextRequest) {
  return request.messages.filter((message) => message.role === 'tool');
}

describe('chatTools', () => {
  it('describes create_draft and regenerate_item with JSON Schemas', () => {
    expect(chatTools.map((tool) => tool.name)).toEqual(['create_draft', 'regenerate_item']);
    expect(chatTools[0]!.parameters).toMatchObject({
      type: 'object',
      required: ['channel', 'format', 'angle'],
    });
    expect(chatTools[1]!.parameters).toMatchObject({
      type: 'object',
      required: ['itemId', 'scope', 'feedback'],
      properties: { scope: { enum: ['copy', 'image', 'all'] } },
    });
  });
});

describe('replyToChat', () => {
  it('executes create_draft and feeds the result back so the reply mentions the created item', async () => {
    const brain = new FakeProvider({
      respond: (request) => {
        const [tool] = toolMessages(request);
        return tool
          ? { text: `Done. ${tool.content}`, toolCalls: [], usage }
          : toolResult([draftCall('call-1')]);
      },
    });
    const executeTool = vi.fn(async (call: ToolCall) => `Created draft ${itemId} for ${(call.arguments as { channel: string }).channel}.`);

    const result = await replyToChat(brain, 'fake/text', context, executeTool);

    expect(executeTool).toHaveBeenCalledOnce();
    expect(executeTool).toHaveBeenCalledWith(draftCall('call-1'));
    expect(result.reply).toContain(itemId);
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 4, costUsd: 0.002 });

    const [first, second] = brain.requests as TextRequest[];
    expect(first!.tools).toEqual(chatTools);
    expect(first!.messages[0]!.role).toBe('system');
    const system = first!.messages[0]!.content;
    for (const label of ['brand_dna', 'strategy', 'recent_items']) {
      expect(system).toContain(`<untrusted_content label="${label}">`);
    }
    expect(system).toMatch(/<untrusted_content label="strategy">\n[^<]*Craft/);
    expect(system).toMatch(new RegExp(`<untrusted_content label="recent_items">\\n[^<]*${itemId}`));
    expect(first!.messages.slice(1)).toEqual(context.history);
    expect(second!.messages.slice(-2)).toEqual([
      { role: 'assistant', content: '', toolCalls: [draftCall('call-1')] },
      { role: 'tool', toolCallId: 'call-1', content: `Created draft ${itemId} for instagram.` },
    ]);
  });

  it('does not execute a fourth tool round', async () => {
    let round = 0;
    const brain = new FakeProvider({
      respond: () => {
        round += 1;
        return toolResult([draftCall(`call-${round}`)]);
      },
    });
    const executeTool = vi.fn(async () => 'ok');

    const result = await replyToChat(brain, 'fake/text', context, executeTool);

    expect(executeTool).toHaveBeenCalledTimes(3);
    expect(executeTool).not.toHaveBeenCalledWith(draftCall('call-4'));
    expect(brain.requests).toHaveLength(4);
    expect(result.reply).toBe('I stopped after three rounds of actions.');
    expect(result.usage.inputTokens).toBe(40);
  });

  it('executes at most three tool calls per round and answers the rest as skipped', async () => {
    const calls = [1, 2, 3, 4].map((index) => draftCall(`call-${index}`));
    const brain = new FakeProvider({
      respond: (request) => (toolMessages(request).length > 0 ? 'Done' : toolResult(calls)),
    });
    const executeTool = vi.fn(async (call: ToolCall) => `ran ${call.id}`);

    await replyToChat(brain, 'fake/text', context, executeTool);

    expect(executeTool.mock.calls.map(([call]) => call.id)).toEqual(['call-1', 'call-2', 'call-3']);
    expect(toolMessages((brain.requests as TextRequest[])[1]!)).toEqual([
      { role: 'tool', toolCallId: 'call-1', content: 'ran call-1' },
      { role: 'tool', toolCallId: 'call-2', content: 'ran call-2' },
      { role: 'tool', toolCallId: 'call-3', content: 'ran call-3' },
      { role: 'tool', toolCallId: 'call-4', content: 'Skipped: too many actions in one step.' },
    ]);
  });

  it('reports the running usage total before a later round fails', async () => {
    const brain = new FakeProvider({
      textResponses: [toolResult([draftCall('call-1')]), new ProviderError('rate_limited', 'slow down')],
    });
    const totals: Usage[] = [];

    await expect(
      replyToChat(brain, 'fake/text', context, async () => 'ok', (total) => totals.push(total)),
    ).rejects.toMatchObject({ code: 'rate_limited' });

    expect(totals).toEqual([usage]);
  });

  it('returns invalid tool arguments to the model as an error string', async () => {
    const createDraft = vi.fn(async () => ({ result: 'created' }));
    const execute = createChatToolExecutor({ create_draft: createDraft, regenerate_item: vi.fn() });
    const brain = new FakeProvider({
      respond: (request) => {
        const [tool] = toolMessages(request);
        return tool
          ? `Sorry: ${tool.content}`
          : toolResult([draftCall('call-1', { channel: 'email', format: 'carousel', angle: 'x' })]);
      },
    });

    const result = await replyToChat(brain, 'fake/text', context, async (call) => (await execute(call)).result);

    expect(createDraft).not.toHaveBeenCalled();
    expect(result.reply).toMatch(/^Sorry: Invalid arguments for create_draft/);
    expect(result.reply).toContain('format');
  });
});

describe('createChatToolExecutor', () => {
  it('passes parsed arguments to the matching handler', async () => {
    const regenerate = vi.fn(async () => ({ result: 'regenerating', itemId }));
    const execute = createChatToolExecutor({ create_draft: vi.fn(), regenerate_item: regenerate });

    const outcome = await execute({
      id: 'c',
      name: 'regenerate_item',
      arguments: { itemId, scope: 'copy', feedback: '  shorter  ' },
    });

    expect(regenerate).toHaveBeenCalledWith({ itemId, scope: 'copy', feedback: 'shorter' });
    expect(outcome).toEqual({ result: 'regenerating', itemId });
  });

  it('answers unknown tools and malformed arguments without throwing', async () => {
    const execute = createChatToolExecutor({ create_draft: vi.fn(), regenerate_item: vi.fn() });
    expect(await execute({ id: 'c', name: 'delete_brand', arguments: {} })).toEqual({
      result: 'Unknown tool delete_brand.',
    });
    expect((await execute({ id: 'c', name: 'regenerate_item', arguments: 'nope' })).result).toMatch(
      /^Invalid arguments for regenerate_item/,
    );
  });
});

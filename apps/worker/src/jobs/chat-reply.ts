import {
  buildRepurposeInstruction,
  ChatMessageNotFoundError,
  createChatToolExecutor,
  createOnDemandItems,
  defineJob,
  describeItemForCritique,
  findUserChatMessage,
  getItemWithCurrentVersion,
  hasChatReply,
  insertChatMessage,
  InvalidTransitionError,
  loadChatContext,
  replyToChat,
  requestRegeneration,
  resolveModels,
  type ChatMessage,
  type ExecutedToolCall,
  type FormatCopy,
} from '@openlumo/core';
import type { WorkerDependencies } from '../worker-dependencies';

function createToolExecutor({ db, boss }: WorkerDependencies, message: ChatMessage) {
  const { brandId, userId } = message;
  const notFound = (itemId: string) => ({ result: `Item ${itemId} was not found.` });
  const findOwnItem = async (itemId: string) => {
    const found = await getItemWithCurrentVersion(db, itemId);
    return found?.item.brandId === brandId ? found : null;
  };
  return createChatToolExecutor({
    async create_draft({ channel, format, angle }) {
      const [itemId] = await createOnDemandItems(db, boss, { brandId, channel, format, instruction: angle, variants: 1 });
      return {
        result: `Created ${format} draft ${itemId} for ${channel}. It is being written now and lands on the board in review.`,
        itemId,
      };
    },
    async regenerate_item({ itemId, scope, feedback }) {
      if (!(await findOwnItem(itemId))) return notFound(itemId);
      try {
        await requestRegeneration(db, boss, { itemId, scope, feedback, userId });
      } catch (error) {
        if (error instanceof InvalidTransitionError) return { result: error.message };
        throw error;
      }
      return { result: `Regenerating the ${scope === 'all' ? 'copy and image' : scope} of item ${itemId}.`, itemId };
    },
    async critique_item({ itemId }) {
      const found = await findOwnItem(itemId);
      if (!found) return notFound(itemId);
      if (!found.version) return { result: `Item ${itemId} has no copy yet.` };
      return { result: describeItemForCritique(found.item, found.version.copy) };
    },
    async repurpose_item({ itemId: sourceId, channel, format, angle }) {
      const found = await findOwnItem(sourceId);
      if (!found) return notFound(sourceId);
      if (!found.version) return { result: `Item ${sourceId} has no copy to repurpose yet.` };
      const source = { channel: found.item.channel, format: found.item.format, copy: found.version.copy as FormatCopy };
      const instruction = buildRepurposeInstruction(source, { channel, format, angle });
      const [itemId] = await createOnDemandItems(db, boss, { brandId, channel, format, instruction, variants: 1 });
      return {
        result: `Created ${format} draft ${itemId} for ${channel} from item ${sourceId}. It is being written now and lands on the board in review.`,
        itemId,
      };
    },
  });
}

function partialReply(executed: ExecutedToolCall[]): string {
  return ["I couldn't finish my reply, but I already did this:", ...executed.map((call) => `- ${call.result}`)].join('\n');
}

export function createChatReplyJob(deps: WorkerDependencies) {
  const { db, config } = deps;
  return defineJob('chat.reply', async ({ brandId, messageId }, context) => {
    const message = await findUserChatMessage(db, brandId, messageId);
    if (!message) throw new ChatMessageNotFoundError(messageId);
    if (await hasChatReply(db, messageId)) return;

    await context.reportProgress('Thinking');
    const chatContext = await loadChatContext(db, message);
    const { brain } = await resolveModels(db, config);
    const execute = createToolExecutor(deps, message);
    const executed: ExecutedToolCall[] = [];
    let spent = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    let reply: string;
    try {
      ({ reply } = await replyToChat(
        brain.model,
        brain.modelId,
        chatContext,
        async (call) => {
          const outcome = await execute(call);
          executed.push({ ...call, ...outcome });
          return outcome.result;
        },
        (total) => {
          spent = total;
        },
      ));
    } catch (error) {
      const actions = executed.filter((call) => call.itemId);
      if (actions.length === 0) throw error;
      reply = partialReply(actions);
    } finally {
      await context.recordUsage(spent);
    }
    await insertChatMessage(db, {
      brandId,
      userId: message.userId,
      role: 'assistant',
      content: reply,
      toolCalls: executed,
      replyToId: messageId,
    });
  });
}

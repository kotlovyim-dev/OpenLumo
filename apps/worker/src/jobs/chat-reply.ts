import {
  ChatMessageNotFoundError,
  createChatToolExecutor,
  createOnDemandItems,
  defineJob,
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
} from '@openlumo/core';
import type { WorkerDependencies } from '../worker-dependencies';

function createToolExecutor({ db, boss }: WorkerDependencies, message: ChatMessage) {
  const { brandId, userId } = message;
  return createChatToolExecutor({
    async create_draft({ channel, format, angle }) {
      const [itemId] = await createOnDemandItems(db, boss, { brandId, channel, format, instruction: angle, variants: 1 });
      return {
        result: `Created ${format} draft ${itemId} for ${channel}. It is being written now and lands on the board in review.`,
        itemId,
      };
    },
    async regenerate_item({ itemId, scope, feedback }) {
      const found = await getItemWithCurrentVersion(db, itemId);
      if (found?.item.brandId !== brandId) return { result: `Item ${itemId} was not found.` };
      try {
        await requestRegeneration(db, boss, { itemId, scope, feedback, userId });
      } catch (error) {
        if (error instanceof InvalidTransitionError) return { result: error.message };
        throw error;
      }
      return { result: `Regenerating the ${scope === 'all' ? 'copy and image' : scope} of item ${itemId}.`, itemId };
    },
  });
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
    const { reply, usage } = await replyToChat(brain.model, brain.modelId, chatContext, async (call) => {
      const outcome = await execute(call);
      executed.push({ ...call, ...outcome });
      return outcome.result;
    });
    await context.recordUsage(usage);
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

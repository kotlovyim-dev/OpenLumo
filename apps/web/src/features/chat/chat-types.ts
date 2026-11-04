export type ChatEntry = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  changedItems: boolean;
};

export type PendingReply = { messageId: string; status: 'queued' | 'running' | 'failed'; step: string | null };

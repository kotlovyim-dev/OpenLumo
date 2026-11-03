import type { Usage } from '../types';

export type WireUsage = { prompt_tokens?: number; completion_tokens?: number; cost?: number };

export function readUsage(usage: WireUsage | undefined): Usage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    costUsd: usage?.cost ?? 0,
  };
}

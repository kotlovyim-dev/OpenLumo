import type { TextRequest } from '@openlumo/providers';

export const fakeResponses: Record<string, (request: TextRequest) => unknown> = {};

export const defaultFakeReply = 'ok';

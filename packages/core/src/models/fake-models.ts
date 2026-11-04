import { FakeProvider, ProviderError, type ImageModel } from '@openlumo/providers';
import { defaultFakeReply, fakeChatReply, fakeResearchBrief, fakeResearchSources, fakeResponses } from './fake-responses';
import type { ResolvedModels } from './registry';

const failedOncePrompts = new Set<string>();

function createFakeBrain(): FakeProvider {
  return new FakeProvider({
    respond: (request) => {
      if (request.webSearch) {
        return {
          text: fakeResearchBrief,
          toolCalls: [],
          citations: fakeResearchSources,
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
        };
      }
      const fixture = fakeResponses[request.jsonSchema?.name ?? ''];
      if (fixture) return JSON.stringify(fixture(request));
      return request.tools ? fakeChatReply(request) : defaultFakeReply;
    },
  });
}

function createFakeImage(): ImageModel {
  const provider = new FakeProvider();
  return {
    async generate(request) {
      if (request.prompt.includes('#fail-once') && !failedOncePrompts.has(request.prompt)) {
        failedOncePrompts.add(request.prompt);
        throw new ProviderError('invalid_output', 'Scripted one-time image failure');
      }
      return provider.generate(request);
    },
  };
}

export function createFakeCatalog(): FakeProvider {
  return new FakeProvider();
}

export function createFakeModels(): ResolvedModels {
  return {
    brain: { model: createFakeBrain(), modelId: 'fake/text' },
    image: { model: createFakeImage(), modelId: 'fake/image' },
    catalog: createFakeCatalog(),
  };
}

import { describe } from 'vitest';
import { createOpenRouter } from '../../src/openrouter';
import { runImageModelContract, runLanguageModelContract } from '../../src/testing/contract-suite';

const apiKey = process.env.OPENROUTER_API_KEY;
const brainModel = process.env.OPENROUTER_TEST_BRAIN_MODEL ?? '';
const imageModel = process.env.OPENROUTER_TEST_IMAGE_MODEL ?? '';

describe.skipIf(!apiKey)('OpenRouter live', () => {
  runLanguageModelContract('OpenRouter live', () => {
    const provider = createOpenRouter(apiKey ?? '');
    return { complete: (request) => provider.complete({ ...request, model: brainModel }) };
  });
  runImageModelContract('OpenRouter live', () => {
    const provider = createOpenRouter(apiKey ?? '');
    return { generate: (request) => provider.generate({ ...request, model: imageModel }) };
  });
});

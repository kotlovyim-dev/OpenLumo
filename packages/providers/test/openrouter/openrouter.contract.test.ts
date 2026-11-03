import { createOpenRouter } from '../../src/openrouter';
import { runImageModelContract, runLanguageModelContract } from '../../src/testing/contract-suite';
import { imageCompletion, jsonResponse, stubFetch, textCompletion } from './stub-fetch';

runLanguageModelContract('OpenRouter', () =>
  createOpenRouter('key', stubFetch(() => jsonResponse(textCompletion)).fetchImplementation),
);
runImageModelContract('OpenRouter', () =>
  createOpenRouter('key', stubFetch(() => jsonResponse(imageCompletion)).fetchImplementation),
);

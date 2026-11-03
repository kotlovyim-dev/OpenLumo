import { FakeProvider } from '../src/fake/fake-provider';
import { runImageModelContract, runLanguageModelContract } from '../src/testing/contract-suite';

runLanguageModelContract('FakeProvider', () => new FakeProvider({ textResponses: ['hello'] }));
runImageModelContract('FakeProvider', () => new FakeProvider());

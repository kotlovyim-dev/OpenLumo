import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../../src/secrets/encryption';

const appSecret = 's'.repeat(32);

describe('secret encryption', () => {
  it('round-trips', () => {
    expect(decryptSecret(encryptSecret('sk-or-123', appSecret), appSecret)).toBe('sk-or-123');
  });

  it('uses a fresh iv each time', () => {
    expect(encryptSecret('x', appSecret).iv).not.toBe(encryptSecret('x', appSecret).iv);
  });

  it('rejects a different app secret', () => {
    expect(() => decryptSecret(encryptSecret('x', appSecret), 't'.repeat(32))).toThrow();
  });

  it('rejects tampered ciphertext', () => {
    const secret = encryptSecret('hello world', appSecret);
    const first = secret.ciphertext[0] === 'A' ? 'B' : 'A';
    expect(() => decryptSecret({ ...secret, ciphertext: first + secret.ciphertext.slice(1) }, appSecret)).toThrow();
  });
});

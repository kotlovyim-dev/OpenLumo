import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export type EncryptedSecret = { ciphertext: string; iv: string; authTag: string };

function deriveKey(appSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', appSecret, 'openlumo', 'secrets', 32));
}

export function encryptSecret(plaintext: string, appSecret: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(appSecret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(secret: EncryptedSecret, appSecret: string): string {
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(appSecret), Buffer.from(secret.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

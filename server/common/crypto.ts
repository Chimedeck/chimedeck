// AES-256-GCM symmetric encryption for secrets stored in the DB.
// Used for webhook signing secrets — must be decryptable at dispatch time,
// so one-way hashing is not an option.
//
// Ciphertext format (all packed into a single base64 string):
//   <iv: 12 bytes> | <ciphertext: N bytes> | <authTag: 16 bytes>
//
// Key source: env.WEBHOOK_SECRET_ENCRYPTION_KEY (64 hex chars = 32 bytes).
// Generate with: openssl rand -hex 32
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTE_LEN = 32;
const IV_BYTE_LEN = 12;  // 96-bit IV is the GCM recommendation
const TAG_BYTE_LEN = 16;

function keyFromHex(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_BYTE_LEN) {
    throw new Error(
      'Encryption key must be exactly 64 hex characters (32 bytes). ' +
      'Generate one with: openssl rand -hex 32',
    );
  }
  return key;
}

/**
 * Encrypts a plaintext string.
 * Returns a single base64 string: base64(iv + ciphertext + authTag).
 */
export function encryptSecret({ plaintext, hexKey }: { plaintext: string; hexKey: string }): string {
  const key = keyFromHex(hexKey);
  const iv = randomBytes(IV_BYTE_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // [why] pack into one field so the DB schema stays a single text column
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * Decrypts a ciphertext produced by encryptSecret.
 * Throws if the auth tag does not match (tampered or wrong key).
 */
export function decryptSecret({ ciphertext, hexKey }: { ciphertext: string; hexKey: string }): string {
  const key = keyFromHex(hexKey);
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_BYTE_LEN);
  const tag = buf.subarray(buf.length - TAG_BYTE_LEN);
  const encrypted = buf.subarray(IV_BYTE_LEN, buf.length - TAG_BYTE_LEN);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

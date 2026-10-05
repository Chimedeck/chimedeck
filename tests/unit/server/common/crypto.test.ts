import { describe, expect, it } from 'bun:test';
import { decryptSecret, encryptSecret } from '../../../../server/common/crypto';

const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('secret encryption', () => {
  it('round-trips UTF-8 plaintext', () => {
    const plaintext = 'Webhook secret: café 🔐';

    expect(decryptSecret({ ciphertext: encryptSecret({ plaintext, hexKey }), hexKey })).toBe(plaintext);
  });

  it('rejects ciphertext modified after encryption', () => {
    const ciphertext = encryptSecret({ plaintext: 'secret', hexKey });
    const bytes = Buffer.from(ciphertext, 'base64');
    const firstCiphertextByte = 12;
    bytes[firstCiphertextByte] = (bytes[firstCiphertextByte] ?? 0) ^ 1;

    expect(() => decryptSecret({ ciphertext: bytes.toString('base64'), hexKey })).toThrow();
  });
});

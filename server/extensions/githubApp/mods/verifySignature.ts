// Signature verification for GitHub App webhooks.
//
// GitHub signs every webhook delivery with HMAC-SHA256 over the raw request body
// and sends the result in `X-Hub-Signature-256` as `sha256=<hex>`. We verify by:
//   1. Reading the raw body bytes (the signature is computed over the literal
//      bytes, so any JSON.stringify/parse round trip would invalidate it).
//   2. Computing HMAC-SHA256 with the same key.
//   3. Comparing the two digests with timing-safe equality.
//
// We accept two possible keys, in order:
//   1. The per-installation secret stored in `github_app_installations.webhook_secret_encrypted`
//      (decrypted with WEBHOUB_SECRET_ENCRYPTION_KEY).
//   2. The GITHUB_APP_WEBHOOK_SECRET env fallback, used during the very first
//      `installation.created` event when we don't yet have a per-installation
//      secret on file.
//
// If none of the candidate keys match (or the header is missing), we return false
// and the caller responds with 401.
import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_HEADER = 'x-hub-signature-256';
const SIGNATURE_PREFIX = 'sha256=';

export interface VerifySignatureInput {
  rawBody: string;
  signatureHeader: string | null;
  /**
   * Candidate secrets to try, in order. The verifier returns true on the
   * first match. Supplying an empty array is treated as "no secret available"
   * and always returns false.
   */
  candidateSecrets: string[];
}

export function verifyGitHubWebhookSignature({
  rawBody,
  signatureHeader,
  candidateSecrets,
}: VerifySignatureInput): boolean {
  if (!signatureHeader || candidateSecrets.length === 0) return false;
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) return false;

  const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (!/^[0-9a-f]+$/i.test(providedHex)) return false;

  let providedBuffer: Buffer;
  try {
    providedBuffer = Buffer.from(providedHex, 'hex');
  } catch {
    return false;
  }
  // [why] HMAC-SHA256 always yields a 32-byte digest; reject early to avoid
  // a misleading timingSafeEqual result when lengths diverge.
  if (providedBuffer.length !== 32) return false;

  const bodyBuffer = Buffer.from(rawBody, 'utf8');

  for (const secret of candidateSecrets) {
    if (!secret) continue;
    const expected = createHmac('sha256', secret).update(bodyBuffer).digest();
    if (expected.length !== providedBuffer.length) continue;
    // [why] timingSafeEqual prevents an attacker from probing the digest one
    // byte at a time and observing how long the comparison took.
    if (timingSafeEqual(expected, providedBuffer)) return true;
  }
  return false;
}

export const GITHUB_SIGNATURE_HEADER = SIGNATURE_HEADER;

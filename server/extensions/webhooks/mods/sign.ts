// [why] HMAC-SHA256 signing for outgoing webhook requests.
// The receiving server uses the header to verify payload authenticity and freshness.
import { createHmac } from 'node:crypto';

/**
 * Produces the HMAC-SHA256 hex digest for the signed payload string `<timestamp>.<body>`.
 */
export function signPayload({
  secret,
  timestamp,
  body,
}: {
  secret: string;
  timestamp: number;
  body: string;
}): string {
  const signedPayload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(signedPayload).digest('hex');
}

/**
 * Builds the Webhook-Signature header value: `t=<unix_seconds>,v0=<hmac_hex>`.
 * Callers should set this as the `Webhook-Signature` request header.
 */
export function buildSignatureHeader({
  secret,
  body,
}: {
  secret: string;
  body: string;
}): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = signPayload({ secret, timestamp, body });
  return `t=${timestamp},v0=${sig}`;
}

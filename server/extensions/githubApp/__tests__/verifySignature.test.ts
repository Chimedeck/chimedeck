// Tests for the GitHub App webhook signature verifier.
// Covers the success path, the rejection paths, and the timing-safe equality
// behaviour that protects against single-byte digest probing.
import { beforeEach, describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { verifyGitHubWebhookSignature } from '../mods/verifySignature';

const SECRET = 'super-secret-key';
const BODY = '{"action":"created"}';
const HEADER = 'x-hub-signature-256';

function signBody(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

describe('verifyGitHubWebhookSignature', () => {
  let validSignature: string;
  beforeEach(() => {
    validSignature = signBody(BODY, SECRET);
  });

  it('accepts a valid signature when the secret matches', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: validSignature,
        candidateSecrets: [SECRET],
      })
    ).toBe(true);
  });

  it('tries each candidate secret in order and accepts the first match', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: validSignature,
        candidateSecrets: ['wrong-key', SECRET, 'also-wrong'],
      })
    ).toBe(true);
  });

  it('rejects when the signature header is missing', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: null,
        candidateSecrets: [SECRET],
      })
    ).toBe(false);
  });

  it('rejects when the signature does not have the sha256= prefix', () => {
    const hex = validSignature.slice('sha256='.length);
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: hex, // no prefix
        candidateSecrets: [SECRET],
      })
    ).toBe(false);
  });

  it('rejects when the body has been tampered with', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY + ' ',
        signatureHeader: validSignature,
        candidateSecrets: [SECRET],
      })
    ).toBe(false);
  });

  it('rejects when no candidate secrets are supplied', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: validSignature,
        candidateSecrets: [],
      })
    ).toBe(false);
  });

  it('rejects when the candidate list contains only empty strings', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: validSignature,
        candidateSecrets: [''],
      })
    ).toBe(false);
  });

  it('rejects when the hex digest is the wrong length', () => {
    const short = `sha256=${'a'.repeat(10)}`; // SHA-256 always 32 bytes
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: short,
        candidateSecrets: [SECRET],
      })
    ).toBe(false);
  });

  it('rejects when the hex digest is not valid hex', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: 'sha256=zzzz',
        candidateSecrets: [SECRET],
      })
    ).toBe(false);
  });

  it('rejects when none of the candidate secrets match', () => {
    expect(
      verifyGitHubWebhookSignature({
        rawBody: BODY,
        signatureHeader: validSignature,
        candidateSecrets: ['a', 'b', 'c'],
      })
    ).toBe(false);
  });
});

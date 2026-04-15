import { describe, it, expect } from 'bun:test';
import { createHmac } from 'node:crypto';
import { signPayload, buildSignatureHeader } from '../../../../../../server/extensions/webhooks/mods/sign';

describe('signPayload()', () => {
  const secret = 'test-secret-key';
  const body = '{"event":"card.created","data":{}}';
  const timestamp = 1700000000;

  it('produces a 64-character hex string (SHA-256 output)', () => {
    const sig = signPayload({ secret, timestamp, body });
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the correct HMAC-SHA256 for the signed payload', () => {
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    expect(signPayload({ secret, timestamp, body })).toBe(expected);
  });

  it('returns different signatures for different timestamps', () => {
    const sig1 = signPayload({ secret, timestamp: 1000, body });
    const sig2 = signPayload({ secret, timestamp: 1001, body });
    expect(sig1).not.toBe(sig2);
  });

  it('returns different signatures for different bodies', () => {
    const sig1 = signPayload({ secret, timestamp, body: '{"a":1}' });
    const sig2 = signPayload({ secret, timestamp, body: '{"a":2}' });
    expect(sig1).not.toBe(sig2);
  });

  it('returns different signatures for different secrets', () => {
    const sig1 = signPayload({ secret: 'secret-a', timestamp, body });
    const sig2 = signPayload({ secret: 'secret-b', timestamp, body });
    expect(sig1).not.toBe(sig2);
  });

  it('handles an empty body string', () => {
    const sig = signPayload({ secret, timestamp, body: '' });
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('buildSignatureHeader()', () => {
  const secret = 'test-secret-key';
  const body = '{"event":"card.updated","data":{}}';

  it('returns a string matching t=<int>,v0=<hex64>', () => {
    const header = buildSignatureHeader({ secret, body });
    expect(header).toMatch(/^t=\d+,v0=[0-9a-f]{64}$/);
  });

  it('embeds the current unix timestamp (within a 5-second window)', () => {
    const before = Math.floor(Date.now() / 1000);
    const header = buildSignatureHeader({ secret, body });
    const after = Math.floor(Date.now() / 1000);

    const ts = parseInt(header.split(',')[0].slice(2), 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 1);
  });

  it('v0 value matches signPayload with the same timestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const header = buildSignatureHeader({ secret, body });
    const after = Math.floor(Date.now() / 1000);

    const [tPart, v0Part] = header.split(',');
    const ts = parseInt(tPart.slice(2), 10);
    const v0 = v0Part.slice(3);

    // Timestamp must be within the captured window.
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 1);

    const expectedSig = signPayload({ secret, timestamp: ts, body });
    expect(v0).toBe(expectedSig);
  });

  it('two calls produce different timestamps and therefore different signatures', async () => {
    // Force a 1-second gap so timestamps differ.
    const header1 = buildSignatureHeader({ secret, body });
    await new Promise((r) => setTimeout(r, 1100));
    const header2 = buildSignatureHeader({ secret, body });
    expect(header1).not.toBe(header2);
  });
});

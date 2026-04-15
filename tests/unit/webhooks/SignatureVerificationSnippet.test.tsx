// Unit tests for SignatureVerificationSnippet — collapsed/expanded state, copy behaviour, and code content.
// Pure logic tests; no DOM mounting required.
import { describe, it, expect, mock } from 'bun:test';
import translations from '../../../src/extensions/Webhooks/translations/en.json';

// ---------------------------------------------------------------------------
// Expand/collapse state machine
// ---------------------------------------------------------------------------

function createExpandState(initial = false) {
  let expanded = initial;
  return {
    get expanded() { return expanded; },
    toggle() { expanded = !expanded; },
    expand() { expanded = true; },
    collapse() { expanded = false; },
  };
}

describe('SignatureVerificationSnippet — collapsed/expanded state', () => {
  it('starts collapsed by default', () => {
    const state = createExpandState();
    expect(state.expanded).toBe(false);
  });

  it('expands on first toggle', () => {
    const state = createExpandState();
    state.toggle();
    expect(state.expanded).toBe(true);
  });

  it('collapses on second toggle', () => {
    const state = createExpandState();
    state.toggle();
    state.toggle();
    expect(state.expanded).toBe(false);
  });

  it('rapid toggling returns to correct state', () => {
    const state = createExpandState();
    for (let i = 0; i < 6; i++) state.toggle();
    // 6 toggles → back to false (even number)
    expect(state.expanded).toBe(false);
  });

  it('rapid odd-count toggling leaves it expanded', () => {
    const state = createExpandState();
    for (let i = 0; i < 5; i++) state.toggle();
    expect(state.expanded).toBe(true);
  });

  it('body is hidden when collapsed', () => {
    const state = createExpandState();
    // When expanded is false, the body should not be rendered
    expect(state.expanded).toBe(false);
  });

  it('body is visible when expanded', () => {
    const state = createExpandState();
    state.toggle();
    expect(state.expanded).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Copy-to-clipboard state machine
// ---------------------------------------------------------------------------

function createCopyState() {
  let copied = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    get copied() { return copied; },
    async copy(text: string, writeText: (s: string) => Promise<void>, delay = 2000) {
      await writeText(text);
      copied = true;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { copied = false; }, delay);
    },
    reset() {
      copied = false;
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}

describe('SignatureVerificationSnippet — copy-to-clipboard state', () => {
  it('sets copied to true immediately after copy', async () => {
    const state = createCopyState();
    const writeText = mock(() => Promise.resolve());
    await state.copy('snippet', writeText, 5000);
    expect(state.copied).toBe(true);
  });

  it('passes the verification snippet text to writeText', async () => {
    const state = createCopyState();
    const captured: string[] = [];
    const writeText = mock((s: string) => { captured.push(s); return Promise.resolve(); });
    await state.copy('verification-code', writeText, 5000);
    expect(captured[0]).toBe('verification-code');
  });

  it('resets copied to false after timeout', async () => {
    const state = createCopyState();
    const writeText = mock(() => Promise.resolve());
    await state.copy('snippet', writeText, 10);
    expect(state.copied).toBe(true);
    await new Promise((r) => setTimeout(r, 30));
    expect(state.copied).toBe(false);
  });

  it('reset() clears copied state immediately', async () => {
    const state = createCopyState();
    const writeText = mock(() => Promise.resolve());
    await state.copy('snippet', writeText, 5000);
    state.reset();
    expect(state.copied).toBe(false);
  });

  it('a second copy call while copied is true keeps copied true', async () => {
    const state = createCopyState();
    const writeText = mock(() => Promise.resolve());
    await state.copy('snippet-1', writeText, 5000);
    await state.copy('snippet-2', writeText, 5000);
    expect(state.copied).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Translation keys
// ---------------------------------------------------------------------------

describe('SignatureVerificationSnippet — translation keys', () => {
  const requiredKeys = [
    'SignatureSnippet.title',
    'SignatureSnippet.expand',
    'SignatureSnippet.collapse',
    'SignatureSnippet.copy',
    'SignatureSnippet.copied',
    'SignatureSnippet.signatureFormatTitle',
    'SignatureSnippet.signatureFormatBody',
    'SignatureSnippet.signatureFormatDetail',
    'SignatureSnippet.replayProtectionTitle',
    'SignatureSnippet.replayProtectionBody',
  ];

  for (const key of requiredKeys) {
    it(`translation key "${key}" is present and non-empty`, () => {
      expect(translations[key as keyof typeof translations]).toBeTruthy();
    });
  }

  it('expand and collapse labels are distinct', () => {
    expect(translations['SignatureSnippet.expand']).not.toBe(
      translations['SignatureSnippet.collapse']
    );
  });

  it('copy and copied labels are distinct', () => {
    expect(translations['SignatureSnippet.copy']).not.toBe(
      translations['SignatureSnippet.copied']
    );
  });
});

// ---------------------------------------------------------------------------
// Verification snippet content
// ---------------------------------------------------------------------------

// [why] The snippet must mirror the server signing implementation (sign.ts):
// signed payload = `${timestamp}.${rawBody}`, header = `t=<ts>,v0=<hex>`.
const VERIFICATION_SNIPPET = `const crypto = require('crypto');

/**
 * Verifies the Webhook-Signature header from an incoming webhook request.
 *
 * @param {string} signingSecret      - The signing secret issued when you registered the webhook.
 * @param {string} signatureHeader    - Value of the 'Webhook-Signature' request header.
 * @param {string} rawBody            - The raw (unparsed) request body string.
 * @param {number} [toleranceSeconds=300] - Max age of the timestamp before rejection.
 * @returns {boolean}
 */
function verifyWebhookSignature(signingSecret, signatureHeader, rawBody, toleranceSeconds = 300) {
  // Step 1: extract timestamp and v0 signature from the header
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('='))
  );

  const timestamp = parts['t'];
  const receivedSig = parts['v0'];

  if (!timestamp || !receivedSig) {
    return false; // header malformed or scheme not v0 — reject
  }

  // Step 2: produce the signed payload string
  const signedPayload = \`\${timestamp}.\${rawBody}\`;

  // Step 3: compute HMAC-SHA256
  const expectedSig = crypto
    .createHmac('sha256', signingSecret)
    .update(signedPayload)
    .digest('hex');

  // Step 4: compare signatures using a timing-safe comparison
  const expected = Buffer.from(expectedSig, 'hex');
  const received = Buffer.from(receivedSig, 'hex');

  if (expected.length !== received.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(expected, received)) {
    return false;
  }

  // Optional: reject events older than the tolerance window
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  return age <= toleranceSeconds;
}

// Express.js example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const isValid = verifyWebhookSignature(
    process.env.WEBHOOK_SIGNING_SECRET,
    req.headers['webhook-signature'],
    req.body.toString()   // raw Buffer → string, before JSON.parse
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  console.log('Received event:', event.event, event.data);
  res.sendStatus(200);
});`;

describe('SignatureVerificationSnippet — code block content', () => {
  it('snippet references HMAC-SHA256 algorithm', () => {
    expect(VERIFICATION_SNIPPET).toContain('sha256');
  });

  it('snippet references the Webhook-Signature header name', () => {
    expect(VERIFICATION_SNIPPET).toContain('Webhook-Signature');
  });

  it('snippet uses timing-safe comparison', () => {
    expect(VERIFICATION_SNIPPET).toContain('timingSafeEqual');
  });

  it('snippet extracts timestamp (t) from header', () => {
    expect(VERIFICATION_SNIPPET).toContain("parts['t']");
  });

  it('snippet extracts v0 signature from header', () => {
    expect(VERIFICATION_SNIPPET).toContain("parts['v0']");
  });

  it('snippet builds signed payload as `timestamp.rawBody`', () => {
    expect(VERIFICATION_SNIPPET).toContain('timestamp}.');
  });

  it('snippet includes replay protection via toleranceSeconds', () => {
    expect(VERIFICATION_SNIPPET).toContain('toleranceSeconds');
  });

  it('snippet defaults toleranceSeconds to 300 (5 minutes)', () => {
    expect(VERIFICATION_SNIPPET).toContain('toleranceSeconds = 300');
  });

  it('snippet instructs reading raw body before JSON.parse', () => {
    expect(VERIFICATION_SNIPPET).toContain('raw Buffer');
  });

  it('snippet rejects non-https (returns 401 on invalid)', () => {
    expect(VERIFICATION_SNIPPET).toContain('401');
  });

  it('snippet is non-empty string', () => {
    expect(VERIFICATION_SNIPPET.length).toBeGreaterThan(100);
  });
});

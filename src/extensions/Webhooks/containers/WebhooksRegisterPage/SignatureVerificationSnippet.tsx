// SignatureVerificationSnippet — collapsible panel explaining how to verify webhook signatures.
// Collapsed by default; expands to show prose and a JS code example.
import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import translations from '../../translations/en.json';

// [why] Exact implementation must mirror server/extensions/webhooks/mods/sign.ts:
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

export default function SignatureVerificationSnippet() {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(VERIFICATION_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="mt-8 rounded-xl border border-border bg-bg-surface/40"
      data-testid="signature-snippet"
    >
      {/* Toggle header */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-5 py-4 text-left text-sm font-medium text-text-primary hover:bg-bg-surface/60 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
        aria-expanded={expanded}
        aria-controls="signature-snippet-body"
        onClick={() => setExpanded((prev) => !prev)}
        data-testid="signature-snippet-toggle"
      >
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
        )}
        <span>{translations['SignatureSnippet.title']}</span>
        <span className="ml-auto text-xs font-normal text-muted">
          {expanded
            ? translations['SignatureSnippet.collapse']
            : translations['SignatureSnippet.expand']}
        </span>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div
          id="signature-snippet-body"
          className="border-t border-border px-5 pb-5 pt-4 space-y-4"
          data-testid="signature-snippet-body"
        >
          {/* Prose: signature format */}
          <div className="text-sm text-text-secondary space-y-1">
            <p className="font-semibold text-text-primary">
              {translations['SignatureSnippet.signatureFormatTitle']}
            </p>
            <p>{translations['SignatureSnippet.signatureFormatBody']}</p>
            <pre className="mt-1 rounded bg-bg-overlay px-3 py-2 font-mono text-xs text-text-primary">
              Webhook-Signature: t=&lt;unix_timestamp&gt;,v0=&lt;hmac_sha256_hex&gt;
            </pre>
            <p className="mt-1">{translations['SignatureSnippet.signatureFormatDetail']}</p>
          </div>

          {/* Prose: replay protection */}
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">
              {translations['SignatureSnippet.replayProtectionTitle']}
            </span>{' '}
            {translations['SignatureSnippet.replayProtectionBody']}
          </p>

          {/* Code block with copy button */}
          <div className="relative">
            <pre
              className="overflow-x-auto rounded-lg bg-bg-overlay p-4 font-mono text-xs leading-relaxed text-text-primary"
              data-testid="signature-snippet-code"
            >
              <code>{VERIFICATION_SNIPPET}</code>
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-bg-surface/80 px-2 py-1 text-xs text-muted hover:text-text-primary transition-colors"
              aria-label={copied ? translations['SignatureSnippet.copied'] : translations['SignatureSnippet.copy']}
              data-testid="signature-snippet-copy"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
                  {translations['SignatureSnippet.copied']}
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {translations['SignatureSnippet.copy']}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

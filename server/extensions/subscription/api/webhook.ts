import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env';
import { syncSubscriptionFromStripeEvent } from '../common/syncFromStripe';

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

function parseStripeSignatureHeader(signatureHeader: string): {
  timestamp: string | null;
  signatures: string[];
} {
  const segments = signatureHeader.split(',').map((segment) => segment.trim());
  const timestamp = segments.find((segment) => segment.startsWith('t='))?.slice(2) ?? null;
  const signatures = segments
    .filter((segment) => segment.startsWith('v1='))
    .map((segment) => segment.slice(3))
    .filter((signature) => signature.length > 0);
  return { timestamp, signatures };
}

function safeCompareHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyStripeSignature({
  rawBody,
  signatureHeader,
  webhookSecret,
}: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
}): boolean {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) return false;

  const timestamp = Number.parseInt(parsed.timestamp, 10);
  if (!Number.isFinite(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', webhookSecret).update(`${parsed.timestamp}.${rawBody}`).digest('hex');
  return parsed.signatures.some((signature) => safeCompareHex(expected, signature));
}

export async function handleStripeWebhook(req: Request): Promise<Response> {
  if (!env.SUBSCRIPTIONS_ENABLED) {
    return Response.json({ name: 'subscriptions-disabled' }, { status: 503 });
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ name: 'stripe-webhook-not-configured' }, { status: 503 });
  }

  const signatureHeader = req.headers.get('stripe-signature');
  if (!signatureHeader) {
    return Response.json({ name: 'stripe-signature-missing' }, { status: 400 });
  }

  const rawBody = await req.text();
  if (
    !verifyStripeSignature({
      rawBody,
      signatureHeader,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    })
  ) {
    return Response.json({ name: 'invalid-stripe-signature' }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json({ name: 'bad-request', data: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  try {
    const result = await syncSubscriptionFromStripeEvent({
      event: event as Parameters<typeof syncSubscriptionFromStripeEvent>[0]['event'],
    });
    return Response.json({
      data: {
        received: true,
        processed: result.processed,
        idempotent: result.idempotent,
        ignored: result.ignored,
        workspaceId: result.workspaceId ?? null,
        tier: result.tier ?? null,
      },
    });
  } catch (error) {
    return Response.json(
      {
        name: 'stripe-webhook-processing-failed',
        data: { message: error instanceof Error ? error.message : 'Stripe webhook processing failed' },
      },
      { status: 500 },
    );
  }
}

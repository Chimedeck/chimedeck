// POST /api/v1/payments/stripe/payment-link
// Creates a Stripe-hosted Payment Link for a given card amount.
// The link is reusable and opens on Stripe's servers — no embedded checkout needed.
import { stripe } from '../config/stripe';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

const PAYMENT_LINK_PATH = '/api/v1/payments/stripe/payment-link';

export async function paymentRouter(req: Request, pathname: string): Promise<Response | null> {
  if (pathname !== PAYMENT_LINK_PATH || req.method !== 'POST') return null;

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  if (!stripe) {
    return Response.json({ name: 'stripe-not-configured' }, { status: 503 });
  }

  const body = (req as any).body ?? {};
  const { amount, currency = 'usd', cardId = '', label = 'Payment' } = body;

  if (typeof amount !== 'number' || amount <= 0) {
    return Response.json(
      { error: { code: 'invalid-amount', message: 'amount must be a positive number' } },
      { status: 400 },
    );
  }

  try {
    // WHY: Payment Links require a Price object. We create a one-time price on the
    // fly so no pre-existing Stripe product setup is needed per card.
    const price = await stripe.prices.create({
      unit_amount: Math.round(amount),
      currency,
      product_data: {
        name: label,
        metadata: { cardId },
      },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { cardId },
    });

    return Response.json({ data: { url: paymentLink.url, id: paymentLink.id } });
  } catch (err: any) {
    return Response.json(
      { error: { code: 'stripe-error', message: err.message ?? 'Stripe error' } },
      { status: 502 },
    );
  }
}

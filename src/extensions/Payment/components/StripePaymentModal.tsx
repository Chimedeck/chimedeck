// StripePaymentModal — renders Stripe Embedded Checkout in a modal overlay.
// Uses @stripe/react-stripe-js EmbeddedCheckout to display the Stripe UI.
import { useCallback, useEffect, useState } from 'react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { XMarkIcon } from '@heroicons/react/24/outline';
import stripePromise from '../config/stripeClient';
import apiClient from '~/common/api/client';

interface StripePaymentModalProps {
  amountCents: number;
  currency?: string;
  cardId: string;
  onClose: () => void;
}

const StripePaymentModal = ({
  amountCents,
  currency = 'usd',
  cardId,
  onClose,
}: StripePaymentModalProps) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .post<{ data: { clientSecret: string } }>('/api/v1/payments/stripe/create-payment-intent', {
        amount: amountCents,
        currency,
        metadata: { cardId },
      })
      .then((res) => setClientSecret(res.data.data.clientSecret))
      .catch(() => setError('Unable to initialise payment. Please try again.'));
  }, [amountCents, currency, cardId]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors z-10"
          onClick={handleClose}
          aria-label="Close payment modal"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Complete Payment</h2>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {!error && !clientSecret && (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
              Loading payment form…
            </div>
          )}

          {!error && clientSecret && stripePromise && (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}

          {!stripePromise && !error && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
              Stripe is not configured. Set VITE_STRIPE_PUBLIC_KEY to enable payments.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StripePaymentModal;


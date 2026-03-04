// CardPaymentButtons — renders payment action buttons from PAYMENT_BUTTONS config.
// Opens StripePaymentModal when a button is clicked.
import { useState, useCallback } from 'react';
import PAYMENT_BUTTONS from '../../Board/config/stripePaymentButtonsConfig';
import StripePaymentModal from './StripePaymentModal';

interface CardPaymentButtonsProps {
  /** Card amount in cents */
  amountCents: number;
  currency?: string;
  cardId: string;
}

const CardPaymentButtons = ({ amountCents, currency = 'usd', cardId }: CardPaymentButtonsProps) => {
  const [activeAmountCents, setActiveAmountCents] = useState<number | null>(null);

  const handleOpen = useCallback((cents: number, e: React.MouseEvent) => {
    // WHY: stop propagation so click does not bubble up to the card's onClick
    // (which would open the card detail drawer while the modal is opening).
    e.stopPropagation();
    setActiveAmountCents(cents);
  }, []);

  const handleClose = useCallback(() => setActiveAmountCents(null), []);

  return (
    <>
      <div className="mt-2 flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
        {PAYMENT_BUTTONS.map((btn) => {
          const btnAmount = btn.getAmount(amountCents);
          return (
            <button
              key={btn.id}
              className="text-xs px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              onClick={(e) => handleOpen(btnAmount, e)}
              aria-label={btn.label}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {activeAmountCents !== null && (
        <StripePaymentModal
          amountCents={activeAmountCents}
          currency={currency}
          cardId={cardId}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default CardPaymentButtons;

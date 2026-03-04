// PAYMENT_BUTTONS config — defines the payment options shown on eligible cards.
// Each entry specifies a label, and a function to derive the amount in cents
// from the card's amount (which is stored as an integer in cents).
export interface PaymentButton {
  id: string;
  label: string;
  /** Returns the payment amount in cents from the card's raw amount (cents). */
  getAmount: (cardAmountCents: number) => number;
}

const PAYMENT_BUTTONS: PaymentButton[] = [
  {
    id: 'pay-10-percent',
    label: 'Pay 10%',
    getAmount: (cardAmountCents) => Math.round(cardAmountCents * 0.1),
  },
  {
    id: 'pay-in-full',
    label: 'Pay in Full',
    getAmount: (cardAmountCents) => cardAmountCents,
  },
];

export default PAYMENT_BUTTONS;

// CardMoneyBadge — shows a formatted currency amount badge on card tiles.
// Only renders when amount is non-null/non-empty.
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface Props {
  amount: string | null;
  currency?: string | null;
}

const CardMoneyBadge = ({ amount, currency }: Props) => {
  if (!amount) return null;

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) return null;

  const currencyCode = currency || 'USD';

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: numericAmount % 1 === 0 ? 0 : 2,
    }).format(numericAmount);
  } catch {
    // Fallback if currency code is unrecognised at render time
    formatted = `${currencyCode} ${numericAmount}`;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 rounded px-1.5 py-0.5">
      <CurrencyDollarIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {formatted}
    </span>
  );
};

export default CardMoneyBadge;

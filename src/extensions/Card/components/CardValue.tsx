// CardValue — editable amount + currency sidebar section for the card modal.
import { useState, useEffect } from 'react';
import Button from '../../../common/components/Button';

const CURRENCY_REGEX = /^[A-Z]{3}$/;

interface Props {
  amount: string | null;
  currency: string | null;
  onSave: (amount: string | null, currency: string) => Promise<void>;
  disabled?: boolean;
}

const CardValue = ({ amount, currency, onSave, disabled }: Props) => {
  const [amountInput, setAmountInput] = useState(amount ? parseFloat(amount).toString() : '');
  const [currencyInput, setCurrencyInput] = useState(currency || 'USD');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync when prop changes (e.g. after optimistic update confirmation)
  useEffect(() => {
    setAmountInput(amount ? parseFloat(amount).toString() : '');
    setCurrencyInput(currency || 'USD');
  }, [amount, currency]);

  const handleSave = async () => {
    setError(null);

    if (amountInput.trim() === '') {
      await onSave(null, currencyInput.trim().toUpperCase());
      return;
    }

    const parsed = parseFloat(amountInput);
    if (isNaN(parsed) || parsed < 0) {
      setError('Amount must be a positive number.');
      return;
    }

    const currencyTrimmed = currencyInput.trim().toUpperCase();
    if (!CURRENCY_REGEX.test(currencyTrimmed)) {
      setError('Currency must be a 3-letter code (e.g. USD, EUR).');
      return;
    }

    setSaving(true);
    try {
      await onSave(String(parsed), currencyTrimmed);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="0.00"
          className="flex-1 min-w-0 bg-bg-overlay border border-border rounded-lg px-2 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          disabled={disabled || saving}
          aria-label="Amount"
        />
        <input
          type="text"
          maxLength={3}
          placeholder="USD"
          className="w-14 bg-bg-overlay border border-border rounded-lg px-2 py-1.5 text-sm text-base uppercase focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          value={currencyInput}
          onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
          disabled={disabled || saving}
          aria-label="Currency"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {!disabled && (
        <Button
          type="button"
          variant="primary"
          className="w-full text-xs"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}
    </div>
  );
};

export default CardValue;

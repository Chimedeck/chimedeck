// BoardSettings — slide-in panel for board-level settings.
// Sprint 32: adds a Monetization radio group (None / Pre-paid / Pay to Paid).
import { useState } from 'react';
import type { MonetizationType } from '../../api';

interface Props {
  monetizationType: MonetizationType | null;
  isAdmin: boolean;
  onSave: (monetizationType: MonetizationType | null) => Promise<void>;
  onClose: () => void;
}

const MONETIZATION_OPTIONS: { value: MonetizationType | null; label: string; description: string }[] = [
  { value: null,          label: 'None',        description: 'No payment flow enabled.' },
  { value: 'pre-paid',   label: 'Pre-paid',     description: 'Cards must be paid before work begins.' },
  { value: 'pay-to-paid', label: 'Pay to Paid', description: 'Payment buttons appear on cards in qualifying columns.' },
];

const BoardSettings = ({ monetizationType, isAdmin, onSave, onClose }: Props) => {
  const [selected, setSelected] = useState<MonetizationType | null>(monetizationType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-30 bg-black/50"
      onClick={onClose}
      aria-label="Close settings"
    >
      {/* Panel — stop click propagation so clicks inside don't close */}
      <div
        className="absolute right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Board Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold text-sm">Board Settings</h2>
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors"
            onClick={onClose}
            aria-label="Close settings panel"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Monetization section */}
          <section aria-labelledby="monetization-heading">
            <h3 id="monetization-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Monetization
            </h3>
            <div className="space-y-2">
              {MONETIZATION_OPTIONS.map((opt) => (
                <label
                  key={String(opt.value)}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                    selected === opt.value
                      ? 'bg-blue-900/40 border border-blue-600'
                      : 'border border-slate-700 hover:bg-slate-800'
                  } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="monetization"
                    value={String(opt.value)}
                    checked={selected === opt.value}
                    onChange={() => isAdmin && setSelected(opt.value)}
                    disabled={!isAdmin}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span>
                    <span className="block text-sm text-slate-200 font-medium">{opt.label}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {!isAdmin && (
              <p className="mt-2 text-xs text-slate-500">Only board admins can change monetization settings.</p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between gap-2">
          {error && <p className="text-xs text-red-400 flex-1">{error}</p>}
          <div className="flex gap-2 ml-auto">
            <button
              className="px-3 py-1.5 rounded text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !isAdmin}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardSettings;

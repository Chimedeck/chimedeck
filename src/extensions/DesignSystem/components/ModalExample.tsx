// ModalExample — interactive modal demo with open/close state.
// Uses only CSS/Tailwind primitives (no external dialog library) to avoid dependencies.
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';

export default function ModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Button variant="secondary" onClick={() => { setOpen(true); }}>
        Open Modal
      </Button>

      {open && (
        /* Backdrop */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ds-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Dialog panel */}
          <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 id="ds-modal-title" className="text-base font-semibold text-text-primary">
                Example Modal
              </h3>
              <IconButton
                aria-label="Close modal"
                icon={<XMarkIcon className="h-4 w-4" />}
                variant="ghost"
                onClick={() => { setOpen(false); }}
              />
            </div>

            {/* Body */}
            <p className="text-sm text-text-secondary mb-6">
              This is a stub modal demonstrating the overlay pattern, focus management header, and action footer used across the app.
            </p>

            {/* Footer */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setOpen(false); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => { setOpen(false); }}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

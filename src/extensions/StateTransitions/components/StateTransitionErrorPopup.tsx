import { useEffect, useRef } from 'react';
import { CheckCircleIcon, NoSymbolIcon } from '@heroicons/react/24/solid';
import type { StateTransitionRejectionReason } from '../hooks/useStateTransitionGuard';
import translations from '../translations/en.json';

interface Props {
  open: boolean;
  rejection: StateTransitionRejectionReason | null;
  onClose: () => void;
  onViewRules?: () => void;
  autoDismissMs?: number;
}

const DEFAULT_AUTO_DISMISS_MS = 8_000;

export function normalizeAllowedNextStates(
  allowedNextStates: StateTransitionRejectionReason['allowedNextStates']
): StateTransitionRejectionReason['allowedNextStates'] {
  const seen = new Set<string>();
  const normalized: StateTransitionRejectionReason['allowedNextStates'] = [];
  for (const state of allowedNextStates) {
    const id = String(state.id ?? '').trim();
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      name: state.name.trim() || id,
    });
  }
  return normalized;
}

export function getStateTransitionErrorBodyText(rejection: StateTransitionRejectionReason): string {
  if (normalizeAllowedNextStates(rejection.allowedNextStates).length === 0) {
    return translations['StateTransitions.moveLockedBody'].replace(
      '{fromListName}',
      rejection.fromListName
    );
  }
  return translations['StateTransitions.moveNotAllowedBody']
    .replace('{fromListName}', rejection.fromListName)
    .replace('{toListName}', rejection.toListName);
}

const StateTransitionErrorPopup = ({
  open,
  rejection,
  onClose,
  onViewRules,
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
}: Props) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const timeoutId = window.setTimeout(onClose, autoDismissMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoDismissMs, onClose, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open || !rejection) return null;

  const bodyText = getStateTransitionErrorBodyText(rejection);
  const allowedNextStates = normalizeAllowedNextStates(rejection.allowedNextStates);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="state-transition-error-title"
        className="w-full max-w-md rounded-xl border border-border bg-bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <NoSymbolIcon className="mt-0.5 h-6 w-6 shrink-0 text-red-500" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="state-transition-error-title" className="text-base font-semibold text-base">
              {translations['StateTransitions.moveNotAllowedTitle']}
            </h2>
            <p className="mt-2 text-sm text-muted">{bodyText}</p>
          </div>
        </div>

        {allowedNextStates.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {translations['StateTransitions.allowedNextSteps']}
            </p>
            <ul className="mt-2 space-y-1">
              {allowedNextStates.map((state) => (
                <li key={state.id} className="flex items-center gap-2 text-sm text-base">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
                  <span>{state.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          {onViewRules && (
            <button
              type="button"
              onClick={onViewRules}
              className="rounded px-3 py-1.5 text-sm font-medium text-primary hover:bg-bg-overlay"
            >
              {translations['StateTransitions.viewTransitionRulesButton']}
            </button>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {translations['StateTransitions.okButton']}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StateTransitionErrorPopup;

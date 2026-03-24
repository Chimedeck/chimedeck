// Toast — single auto-dismissing notification card.
// Variant 'error' auto-dismisses after 6 s; others after 4 s.
import { useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import translations from '~/common/translations/en.json';

export interface ToastItem {
  id: string;
  message: string;
  /** error = red border; conflict = yellow border */
  variant: 'info' | 'conflict' | 'error';
  durationMs?: number;
}

interface Props {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const Toast = ({ toast, onDismiss }: Props) => {
  useEffect(() => {
    const ms = toast.durationMs ?? (toast.variant === 'error' ? 6000 : 4000);
    const timer = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const borderClass =
    toast.variant === 'error'
      ? 'border-red-500/40'
      : toast.variant === 'conflict'
        ? 'border-yellow-500/40'
        : 'border-slate-700';

  const iconClass =
    toast.variant === 'error'
      ? 'text-red-400'
      : toast.variant === 'conflict'
        ? 'text-yellow-400'
        : 'text-slate-400';

  const IconComponent =
    toast.variant === 'error'
      ? XMarkIcon
      : toast.variant === 'conflict'
        ? ExclamationTriangleIcon
        : InformationCircleIcon;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${borderClass} bg-slate-800 px-4 py-3 shadow-2xl`}
      role="alert"
    >
      <IconComponent className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
      <p className="flex-1 text-sm text-slate-200">{toast.message}</p>
      <button
        className="ml-auto shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        onClick={() => onDismiss(toast.id)}
        aria-label={translations['Common.dismissNotification']}
      >
        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default Toast;

// Toast — single auto-dismissing notification card.
// Variant 'error' auto-dismisses after 6 s; others after 4 s.
import { useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import translations from '~/common/translations/en.json';

export interface ToastItem {
  id: string;
  message: string;
  /** error = red border; conflict = yellow border */
  variant: 'info' | 'conflict' | 'error';
  durationMs?: number;
  onClick?: () => void;
}

interface Props {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const Toast = ({ toast, onDismiss }: Props) => {
  useEffect(() => {
    const ms = toast.durationMs ?? (toast.variant === 'error' ? 6000 : 4000);
    const timer = setTimeout(() => { onDismiss(toast.id); }, ms);
    return () => { clearTimeout(timer); };
  }, [toast, onDismiss]);

  const borderClass =
    toast.variant === 'error'
      ? 'border-red-500/40'
      : toast.variant === 'conflict'
        ? 'border-yellow-500/40'
        : 'border-border';

  const iconClass =
    toast.variant === 'error'
      ? 'text-danger'
      : toast.variant === 'conflict'
        ? 'text-yellow-400'
        : 'text-subtle';

  const IconComponent =
    toast.variant === 'error'
      ? XMarkIcon
      : toast.variant === 'conflict'
        ? ExclamationTriangleIcon
        : InformationCircleIcon;

  const isClickable = typeof toast.onClick === 'function';
  const interactiveClass = isClickable
    ? 'cursor-pointer hover:bg-bg-overlay/70 focus:outline-none focus:ring-2 focus:ring-primary'
    : '';
  const interactiveProps = isClickable
    ? {
      role: 'button' as const,
      tabIndex: 0,
      onClick: () => {
        toast.onClick?.();
        onDismiss(toast.id);
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toast.onClick?.();
        onDismiss(toast.id);
      },
    }
    : {
      role: 'alert' as const,
    };

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${borderClass} bg-bg-surface px-4 py-3 shadow-2xl ${interactiveClass}`}
      {...interactiveProps}
    >
      <IconComponent className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
      <p className="flex-1 text-sm text-base">{toast.message}</p>
      {isClickable && (
        <span className="shrink-0 rounded-md border border-border bg-bg-overlay px-2 py-0.5 text-xs font-medium text-subtle">
          {translations['Common.toastOpenAction']}
        </span>
      )}
      <button
        className="ml-auto shrink-0 text-subtle hover:text-muted transition-colors"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss(toast.id);
        }}
        aria-label={translations['Common.dismissNotification']}
      >
        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default Toast;

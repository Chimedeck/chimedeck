// CardButtonItem — renders a single automation card button.
// Shows the button's custom Heroicon, name, and a spinner while running.
import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { ButtonIcon } from '../shared/IconPicker';
import type { FC } from 'react';
import type { Automation } from '../../types';
import translations from '../../translations/en.json';

export type RunState = 'idle' | 'running' | 'success' | 'error';

interface Props {
  automation: Automation;
  runState: RunState;
  onRun: () => void;
  disabled?: boolean;
}

const CardButtonItem: FC<Props> = ({ automation, runState, onRun, disabled = false }) => {
  const isRunning = runState === 'running';

  return (
    <button
      type="button"
      disabled={disabled || isRunning}
      onClick={onRun}
      className={[
        'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'border border-border bg-bg-surface',
        isRunning
          ? 'cursor-not-allowed opacity-60'
          : 'hover:bg-bg-overlay hover:border-border hover:text-base',
        runState === 'success' ? 'border-emerald-700 bg-emerald-900/20 text-emerald-300' : '',
        runState === 'error' ? 'border-red-700 bg-red-900/20 text-red-300' : '',
        'text-subtle',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Run automation: ${automation.name}`}
    >
      {/* Icon area */}
      <span className="flex-shrink-0 h-4 w-4 flex items-center justify-center">
        {isRunning ? (
          <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-400" aria-hidden="true" />
        ) : runState === 'success' ? (
          <CheckCircleIcon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        ) : runState === 'error' ? (
          <ExclamationCircleIcon className="h-4 w-4 text-red-400" aria-hidden="true" />
        ) : (
          <ButtonIcon name={automation.icon} className="h-4 w-4 text-muted" />
        )}
      </span>

      <span className="flex-1 text-left truncate">{automation.name}</span>

      {isRunning && (
        <span className="text-xs text-muted flex-shrink-0">{translations['automation.cardButtonItem.running']}</span>
      )}
    </button>
  );
};

export default CardButtonItem;

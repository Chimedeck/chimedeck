// BoardButtonItem — icon-only button with tooltip, triggers a board-scoped automation run.
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { ButtonIcon } from '../shared/IconPicker';
import type { FC } from 'react';
import type { Automation } from '../../types';

export type RunState = 'idle' | 'running' | 'success' | 'error';

interface Props {
  automation: Automation;
  runState: RunState;
  onRun: () => void;
}

const BoardButtonItem: FC<Props> = ({ automation, runState, onRun }) => {
  const isRunning = runState === 'running';

  return (
    <div className="relative group">
      <button
        type="button"
        disabled={isRunning}
        onClick={onRun}
        className={[
          'flex items-center justify-center rounded p-1.5 transition-colors',
          isRunning
            ? 'cursor-not-allowed opacity-60 text-slate-400'
            : runState === 'success'
              ? 'text-emerald-400 hover:bg-emerald-900/30'
              : runState === 'error'
                ? 'text-red-400 hover:bg-red-900/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={`Run board button: ${automation.name}`}
      >
        {isRunning ? (
          <ArrowPathIcon className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <ButtonIcon name={automation.icon} className="h-5 w-5" />
        )}
      </button>

      {/* Tooltip */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none"
        role="tooltip"
      >
        <div className="whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 shadow-lg">
          {isRunning ? 'Running…' : automation.name}
        </div>
        <div className="mx-auto h-1.5 w-1.5 rotate-45 bg-slate-700 translate-y-[-3px]" />
      </div>
    </div>
  );
};

export default BoardButtonItem;

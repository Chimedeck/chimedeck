// BoardButtonItem — icon-only button with tooltip, triggers a board-scoped automation run.
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { ButtonIcon } from '../shared/IconPicker';
import type { FC } from 'react';
import type { Automation } from '../../types';
import translations from '../../translations/en.json';

export type RunState = 'idle' | 'running' | 'success' | 'error';

interface Props {
  automation: Automation;
  runState: RunState;
  onRun: () => void;
  /** When true the button sits inside a glassmorphic container over a board background image. */
  hasBackground?: boolean;
}

const BoardButtonItem: FC<Props> = ({ automation, runState, onRun, hasBackground = false }) => {
  const isRunning = runState === 'running';

  let colorClass: string;
  if (isRunning) {
    colorClass = 'cursor-not-allowed opacity-60 text-muted';
  } else if (runState === 'success') {
    colorClass = 'text-emerald-400 hover:bg-emerald-900/30';
  } else if (runState === 'error') {
    colorClass = 'text-danger hover:bg-red-900/30';
  } else if (hasBackground) {
    colorClass = 'text-white/90 hover:bg-white/20 hover:text-white';
  } else {
    colorClass = 'text-muted hover:bg-bg-surface hover:text-subtle';
  }

  return (
    <div className="relative group">
      <button
        type="button"
        disabled={isRunning}
        onClick={onRun}
        className={`flex items-center justify-center rounded p-1.5 transition-colors ${colorClass}`}
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
        <div className="whitespace-nowrap rounded bg-bg-overlay px-2 py-1 text-xs text-base shadow-lg">
          {isRunning ? translations['automation.boardButtonItem.running'] : automation.name}
        </div>
        <div className="mx-auto h-1.5 w-1.5 rotate-45 bg-bg-overlay translate-y-[-3px]" />
      </div>
    </div>
  );
};

export default BoardButtonItem;

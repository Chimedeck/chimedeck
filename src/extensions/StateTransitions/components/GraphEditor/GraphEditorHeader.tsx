import {
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import translations from '../../translations/en.json';

interface Props {
  boardTitle: string;
  enabled: boolean;
  activeEditorCount: number;
  onToggle: (next: boolean) => void;
  toggleLoading: boolean;
  onCopyToBoard: () => void;
  copyBusy: boolean;
  onClose: () => void;
}

export function getPresenceBadgeLabel(activeEditorCount: number): string | null {
  if (activeEditorCount <= 1) return null;
  if (activeEditorCount > 10) {
    return translations['StateTransitions.presenceBadgeOverflow'];
  }
  return translations['StateTransitions.presenceBadge'].replace(
    '{count}',
    String(activeEditorCount)
  );
}

const GraphEditorHeader = ({
  boardTitle,
  enabled,
  activeEditorCount,
  onToggle,
  toggleLoading,
  onCopyToBoard,
  copyBusy,
  onClose,
}: Props) => {
  const presenceLabel = getPresenceBadgeLabel(activeEditorCount);

  return (
    <header className="border-b border-border bg-bg-surface px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ArrowsRightLeftIcon className="h-6 w-6 shrink-0 text-muted" aria-hidden="true" />
            <h2
              id="state-transitions-editor-title"
              className="truncate text-base font-semibold text-base"
            >
              {translations['StateTransitions.editorTitle']} — {boardTitle}
            </h2>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {enabled ? (
              <>
                <CheckBadgeIcon className="h-4 w-4 text-green-500" aria-hidden="true" />
                <span className="text-green-600 dark:text-green-400">
                  {translations['StateTransitions.enforcedHint']}
                </span>
              </>
            ) : (
              <>
                <InformationCircleIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                <span className="text-muted">{translations['StateTransitions.disabledHint']}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {presenceLabel && (
            <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
              {presenceLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onCopyToBoard}
            disabled={copyBusy}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-subtle hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-60"
          >
            <DocumentDuplicateIcon className="h-4 w-4" aria-hidden="true" />
            <span>{translations['StateTransitions.copyToBoardButton']}</span>
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-base">
            <span>{translations['StateTransitions.enforceToggleLabel']}</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={translations['StateTransitions.enforceToggleLabel']}
              onClick={() => {
                onToggle(!enabled);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-primary' : 'bg-bg-sunken'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            {toggleLoading && (
              <ArrowPathIcon
                className="h-4 w-4 animate-spin text-muted"
                aria-label={translations['StateTransitions.saving']}
              />
            )}
          </label>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-subtle hover:bg-bg-overlay"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            <span>{translations['StateTransitions.closeButton']}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default GraphEditorHeader;

import { ArrowLongRightIcon, ChatBubbleBottomCenterTextIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import type { ActionTypeConfig } from '../../config/actionTypes';
import type { StateTransitionAction } from '../../api';
import translations from '../../translations/en.json';

interface Props {
  actionTypes: readonly ActionTypeConfig[];
  selectedAction: StateTransitionAction;
  disabled?: boolean;
  onActionChange: (nextAction: StateTransitionAction) => void;
  onAddColumn: () => void;
  onAddNote: () => void;
}

const GraphEditorToolbar = ({
  actionTypes,
  selectedAction,
  disabled = false,
  onActionChange,
  onAddColumn,
  onAddNote,
}: Props) => (
  <div className="pointer-events-auto absolute left-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2 shadow-lg">
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-base px-2.5 py-1.5 text-xs font-medium text-base hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onAddColumn}
      disabled={disabled}
    >
      <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
      <span>{translations['StateTransitions.toolbarAddColumn']}</span>
    </button>

    <label className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-base px-2.5 py-1.5 text-xs text-base">
      <ArrowLongRightIcon className="h-4 w-4 text-muted" aria-hidden="true" />
      <span>{translations['StateTransitions.toolbarArrowType']}</span>
      <select
        value={selectedAction}
        disabled={disabled}
        className="rounded border border-border bg-bg-base px-2 py-0.5 text-xs text-base"
        onChange={(event) => {
          onActionChange(event.target.value as StateTransitionAction);
        }}
      >
        {actionTypes.map((actionType) => (
          <option key={actionType.id} value={actionType.id}>
            {translations[actionType.labelKey]}
          </option>
        ))}
      </select>
    </label>

    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-base px-2.5 py-1.5 text-xs font-medium text-base hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onAddNote}
      disabled={disabled}
    >
      <ChatBubbleBottomCenterTextIcon className="h-4 w-4" aria-hidden="true" />
      <span>{translations['StateTransitions.toolbarAddNote']}</span>
    </button>
  </div>
);

export default GraphEditorToolbar;

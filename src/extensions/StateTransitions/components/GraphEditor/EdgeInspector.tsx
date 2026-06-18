import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ActionTypeConfig } from '../../config/actionTypes';
import type {
  StateTransitionAction,
  StateTransitionDirection,
  StateTransitionStyle,
} from '../../api';
import translations from '../../translations/en.json';

interface Props {
  actionTypes: readonly ActionTypeConfig[];
  selectedAction: StateTransitionAction;
  selectedDirection: StateTransitionDirection;
  selectedStyle: StateTransitionStyle;
  onActionChange: (nextAction: StateTransitionAction) => void;
  onDirectionChange: (nextDirection: StateTransitionDirection) => void;
  onStyleChange: (nextStyle: StateTransitionStyle) => void;
  onDelete: () => void;
  onClose: () => void;
}

const optionBaseClass = 'rounded border px-2 py-1 text-xs transition';
const optionActiveClass = 'border-primary bg-primary/10 text-base';
const optionInactiveClass =
  'border-border bg-bg-base text-muted hover:bg-bg-overlay hover:text-base';

const EdgeInspector = ({
  actionTypes,
  selectedAction,
  selectedDirection,
  selectedStyle,
  onActionChange,
  onDirectionChange,
  onStyleChange,
  onDelete,
  onClose,
}: Props) => (
  <aside
    data-edge-inspector="true"
    className="nodrag nopan pointer-events-auto absolute right-4 top-4 z-20 w-72 rounded-lg border border-border bg-bg-surface p-3 shadow-xl"
  >
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-base">
        {translations['StateTransitions.edgeInspectorTitle']}
      </h3>
      <button
        type="button"
        aria-label={translations['StateTransitions.edgeInspectorClose']}
        className="rounded p-1 text-muted hover:bg-bg-overlay hover:text-base"
        onClick={onClose}
      >
        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>

    <label className="mb-3 block text-xs text-muted">
      <span className="mb-1 block">{translations['StateTransitions.edgeInspectorAction']}</span>
      <select
        value={selectedAction}
        className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-base"
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

    <div className="mb-3">
      <p className="mb-1 text-xs text-muted">
        {translations['StateTransitions.edgeInspectorDirection']}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          className={`${optionBaseClass} ${selectedDirection === 'one_way' ? optionActiveClass : optionInactiveClass}`}
          onClick={() => {
            onDirectionChange('one_way');
          }}
        >
          {translations['StateTransitions.edgeDirectionOneWay']}
        </button>
        <button
          type="button"
          className={`${optionBaseClass} ${selectedDirection === 'two_way' ? optionActiveClass : optionInactiveClass}`}
          onClick={() => {
            onDirectionChange('two_way');
          }}
        >
          {translations['StateTransitions.edgeDirectionTwoWay']}
        </button>
      </div>
    </div>

    <div className="mb-3">
      <p className="mb-1 text-xs text-muted">
        {translations['StateTransitions.edgeInspectorStyle']}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          className={`${optionBaseClass} ${selectedStyle === 'straight' ? optionActiveClass : optionInactiveClass}`}
          onClick={() => {
            onStyleChange('straight');
          }}
        >
          {translations['StateTransitions.edgeStyleStraight']}
        </button>
        <button
          type="button"
          className={`${optionBaseClass} ${selectedStyle === 'orthogonal' ? optionActiveClass : optionInactiveClass}`}
          onClick={() => {
            onStyleChange('orthogonal');
          }}
        >
          {translations['StateTransitions.edgeStyleOrthogonal']}
        </button>
        <button
          type="button"
          className={`${optionBaseClass} ${selectedStyle === 'smooth' || selectedStyle === 'curved' ? optionActiveClass : optionInactiveClass}`}
          onClick={() => {
            onStyleChange('smooth');
          }}
        >
          {translations['StateTransitions.edgeStyleSmooth']}
        </button>
      </div>
    </div>

    <button
      type="button"
      className="text-xs font-medium text-danger hover:underline"
      onClick={onDelete}
    >
      {translations['StateTransitions.edgeInspectorDelete']}
    </button>
  </aside>
);

export default EdgeInspector;

// ActionList — ordered, draggable list of actions plus "Add action" control.
// Uses @dnd-kit/core for drag-and-drop reordering.
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { PlayIcon, PlusIcon } from '@heroicons/react/24/outline';
import ActionItem, { type ActionItemData } from './ActionItem';
import ActionPicker from './ActionPicker';
import ActionConfig from './ActionConfig';
import { hasConfigFields } from './configFieldRenderer';
import type { ActionType } from '../../../types';

interface Props {
  actions: ActionItemData[];
  onChange: (actions: ActionItemData[]) => void;
  boardId: string;
}

const ActionList = ({ actions, onChange, boardId }: Props) => {
  const [showPicker, setShowPicker] = useState(false);
  // Track which action is being configured (by local id).
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  // Store ActionType metadata keyed by local id so ActionConfig can access the schema.
  const [actionTypeMeta, setActionTypeMeta] = useState<Record<string, ActionType>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = actions.findIndex((a) => a.id === active.id);
    const newIndex = actions.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(actions, oldIndex, newIndex));
  };

  const handlePickAction = (type: ActionType) => {
    const localId = `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newAction: ActionItemData = {
      id: localId,
      actionType: type.type,
      label: type.label,
      config: {},
    };
    onChange([...actions, newAction]);
    setActionTypeMeta((prev) => ({ ...prev, [localId]: type }));
    setShowPicker(false);
    // Open config if the action has configurable fields.
    if (hasConfigFields(type.configSchema)) {
      setConfiguringId(localId);
    }
  };

  const handleDelete = (id: string) => {
    onChange(actions.filter((a) => a.id !== id));
    if (configuringId === id) setConfiguringId(null);
  };

  const handleConfigChange = (id: string, config: Record<string, unknown>) => {
    onChange(actions.map((a) => (a.id === id ? { ...a, config } : a)));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <PlayIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Then do… ({actions.length})
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {actions.map((action) => (
              <div key={action.id}>
                <ActionItem
                  item={action}
                  onDelete={() => handleDelete(action.id)}
                  onConfigChange={(cfg) => handleConfigChange(action.id, cfg)}
                />
                {/* Inline config panel — toggle by clicking the item label */}
                {(() => {
                  const meta = actionTypeMeta[action.id];
                  return configuringId === action.id && meta ? (
                    <ActionConfig
                      actionType={meta}
                      config={action.config}
                      onChange={(cfg) => handleConfigChange(action.id, cfg)}
                      boardId={boardId}
                    />
                  ) : null;
                })()}
                {/* Show/hide config toggle */}
                {(() => {
                  const meta = actionTypeMeta[action.id];
                  if (!meta || !hasConfigFields(meta.configSchema)) return null;
                  return (
                    <button
                      type="button"
                      className="mt-0.5 ml-9 text-xs text-blue-400 hover:underline"
                      onClick={() =>
                        setConfiguringId((prev) => (prev === action.id ? null : action.id))
                      }
                    >
                      {configuringId === action.id ? 'Hide config' : 'Configure…'}
                    </button>
                  );
                })()}
              </div>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {showPicker && (
        <ActionPicker
          onSelect={handlePickAction}
          onCancel={() => setShowPicker(false)}
        />
      )}

      {!showPicker && (
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setShowPicker(true)}
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Add action
        </button>
      )}
    </div>
  );
};

export default ActionList;

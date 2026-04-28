// ActionItem — single action row in the ActionList.
// Shows drag handle, action type label, a brief config summary, and a delete button.
import { useEffect, useState } from 'react';
import { TrashIcon, Bars2Icon } from '@heroicons/react/24/outline';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectLists } from '~/extensions/Board/slices/boardSlice';
import { apiClient } from '~/common/api/client';
import translations from '../../../translations/en.json';

export interface ActionItemData {
  id: string; // local id (stable across re-renders)
  actionType: string;
  label: string;
  config: Record<string, unknown>;
}

type CustomFieldMap = Record<string, { name: string; field_type: string; options: Array<{ id: string; label: string }> }>;

const SIMPLE_FIELD_VALUE_READERS: Record<string, (item: ActionItemData) => string> = {
  TEXT: (item) => (typeof item.config.valueText === 'string' ? item.config.valueText : ''),
  NUMBER: (item) => (typeof item.config.valueNumber === 'number' ? String(item.config.valueNumber) : ''),
  DATE: (item) => (typeof item.config.valueDate === 'string' ? item.config.valueDate.slice(0, 10) : ''),
  CHECKBOX: (item) => (item.config.valueCheckbox === true ? 'Checked' : 'Unchecked'),
};

function getCustomFieldValueLabel(item: ActionItemData, field: CustomFieldMap[string] | undefined): string {
  const fieldType = (typeof item.config.fieldType === 'string' ? item.config.fieldType : field?.field_type) ?? '';

  const simpleReader = SIMPLE_FIELD_VALUE_READERS[fieldType];
  if (simpleReader) return simpleReader(item);

  if (fieldType === 'DROPDOWN') {
    const optionId = typeof item.config.valueOptionId === 'string' ? item.config.valueOptionId : '';
    if (!optionId) return '';
    return field?.options.find((opt) => opt.id === optionId)?.label ?? optionId;
  }

  return '';
}

function getCustomFieldSummary(item: ActionItemData, customFieldsById: CustomFieldMap): string | null {
  if (item.actionType !== 'card.update_custom_field_value') return null;

  const fieldId = typeof item.config.fieldId === 'string' ? item.config.fieldId : '';
  if (!fieldId) return null;

  const field = customFieldsById[fieldId];
  const fieldName = field?.name ?? fieldId;
  const valueLabel = getCustomFieldValueLabel(item, field);

  return valueLabel ? `${fieldName}: ${valueLabel}` : fieldName;
}

interface Props {
  item: ActionItemData;
  onDelete: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  workspaceBoards?: { id: string; title: string }[];
  customFieldsById?: CustomFieldMap;
}

const ActionItem = ({ item, onDelete, workspaceBoards = [], customFieldsById = {} }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const lists = useAppSelector(selectLists);
  const [targetBoardLists, setTargetBoardLists] = useState<Record<string, string>>({});

  // Fetch lists for the target board (cross-board actions like copy_to_board).
  const targetBoardId = typeof item.config.targetBoardId === 'string' ? item.config.targetBoardId : null;
  useEffect(() => {
    if (!targetBoardId) { setTargetBoardLists({}); return; }
    apiClient
      .get(`/boards/${targetBoardId}/lists`)
      .then((res: any) => {
        const map: Record<string, string> = {};
        for (const l of res.data ?? []) map[l.id] = l.title;
        setTargetBoardLists(map);
      })
      .catch(() => {});
  }, [targetBoardId]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Resolve known ID fields to human-readable names; fall back to the raw value.
  const resolveConfigValue = (key: string, value: unknown): string => {
    if (key === 'listId' && typeof value === 'string' && lists[value]) {
      return lists[value].title;
    }
    if (key === 'targetBoardId' && typeof value === 'string') {
      return workspaceBoards.find((b) => b.id === value)?.title ?? value;
    }
    if (key === 'targetListId' && typeof value === 'string') {
      // Prefer the target board's list name; fall back to current board's lists.
      return targetBoardLists[value] ?? lists[value]?.title ?? value;
    }
    if (Array.isArray(value)) {
      const names = (value as string[])
        .map((id) => lists[id]?.title ?? id)
        .filter(Boolean);
      return names.length > 0 ? names.join(', ') : '';
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  };

  // Show the first config value as a summary hint (skip if empty).
  const configSummary = getCustomFieldSummary(item, customFieldsById) ?? Object.entries(item.config)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => resolveConfigValue(k, v))
    .slice(0, 2)
    .join(', ');

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="shrink-0 cursor-grab text-muted hover:text-subtle focus:outline-none"
        aria-label={translations['automation.actionItem.dragAriaLabel']}
        {...attributes}
        {...listeners}
      >
        <Bars2Icon className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Label + summary */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-subtle">{item.label}</p>
        {configSummary && (
          <p className="truncate text-xs text-muted">{configSummary}</p>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-bg-overlay hover:text-danger"
        onClick={onDelete}
        aria-label={`Remove ${item.label} action`}
      >
        <TrashIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
};

export default ActionItem;

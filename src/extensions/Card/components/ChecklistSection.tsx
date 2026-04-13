// ChecklistSection — a single named checklist group: editable title, progress, items, add form, delete.
import { useState, useRef, useEffect, useMemo } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TrashIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import type { Checklist, ChecklistItem as ChecklistItemType } from '../api';
import { ChecklistItem } from './ChecklistItem';
import { ChecklistProgress } from './ChecklistProgress';

const LOW_SENTINEL = '';
const HIGH_SENTINEL = '~';
const BASE = 95;
const NUMERIC_POSITION_PATTERN = /^-?\d+(?:\.\d+)?$/;

const toDigit = (char: string): number => (char.codePointAt(0) ?? 32) - 32;
const toChar = (digit: number): string => String.fromCodePoint(digit + 32);

const toDigits = (value: string): number[] => Array.from(value).map(toDigit);
const fromDigits = (digits: number[]): string => digits.map(toChar).join('');

const compareDigits = (left: number[], right: number[]): number => {
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftDigit = left[index] ?? 0;
    const rightDigit = right[index] ?? BASE - 1;
    if (leftDigit < rightDigit) return -1;
    if (leftDigit > rightDigit) return 1;
  }
  return 0;
};

const betweenPositions = (left: string, right: string): string => {
  if (left === right) return `${left}O`;

  const leftDigits = left === LOW_SENTINEL ? [] : toDigits(left);
  const rightDigits = right === HIGH_SENTINEL ? [] : toDigits(right);

  if (left !== LOW_SENTINEL && right !== HIGH_SENTINEL && compareDigits(leftDigits, rightDigits) >= 0) {
    return `${left}O`;
  }

  const output: number[] = [];
  let index = 0;

  for (;;) {
    const leftDigit = leftDigits[index] ?? 0;
    const rightDigit = rightDigits[index] ?? (BASE - 1);

    if (rightDigit - leftDigit > 1) {
      output.push(Math.floor((leftDigit + rightDigit) / 2));
      break;
    }

    output.push(leftDigit);
    index += 1;
  }

  return fromDigits(output);
};

const compareChecklistItemPosition = (left: string, right: string): number => {
  if (left === right) return 0;
  if (NUMERIC_POSITION_PATTERN.test(left) && NUMERIC_POSITION_PATTERN.test(right)) {
    const delta = Number(left) - Number(right);
    if (delta !== 0) return delta;
  }
  return left < right ? -1 : 1;
};

interface SortableChecklistItemRowProps {
  item: ChecklistItemType;
  boardMembers: Array<{ id: string; email: string; name: string | null; avatar_url?: string | null }>;
  onItemToggle: (itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (itemId: string, title: string) => Promise<void>;
  onItemDelete: (itemId: string) => Promise<void>;
  onItemAssign: (itemId: string, memberId: string | null) => Promise<void>;
  onItemDueDateChange: (itemId: string, dueDate: string | null) => Promise<void>;
  onItemConvertToCard: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

const SortableChecklistItemRow = ({
  item,
  boardMembers,
  onItemToggle,
  onItemRename,
  onItemDelete,
  onItemAssign,
  onItemDueDateChange,
  onItemConvertToCard,
  disabled,
}: SortableChecklistItemRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    ...(disabled === undefined ? {} : { disabled }),
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? 'opacity-70' : undefined}
      {...attributes}
      {...listeners}
    >
      <ChecklistItem
        item={item}
        onToggle={onItemToggle}
        onRename={onItemRename}
        onDelete={onItemDelete}
        onAssign={onItemAssign}
        onDueDateChange={onItemDueDateChange}
        onConvertToCard={onItemConvertToCard}
        boardMembers={boardMembers}
        {...(disabled === undefined ? {} : { disabled })}
      />
    </div>
  );
};

interface Props {
  checklist: Checklist;
  boardMembers: Array<{ id: string; email: string; name: string | null; avatar_url?: string | null }>;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onItemAdd: (title: string) => Promise<void>;
  onItemToggle: (itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (itemId: string, title: string) => Promise<void>;
  onItemDelete: (itemId: string) => Promise<void>;
  onItemAssign: (itemId: string, memberId: string | null) => Promise<void>;
  onItemDueDateChange: (itemId: string, dueDate: string | null) => Promise<void>;
  onItemConvertToCard: (itemId: string) => Promise<void>;
  onItemReorder: (itemId: string, position: string) => Promise<void>;
  disabled?: boolean;
}

export const ChecklistSection = ({
  checklist,
  boardMembers,
  onRename,
  onDelete,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  onItemAssign,
  onItemDueDateChange,
  onItemConvertToCard,
  onItemReorder,
  disabled,
}: Props) => {
  const sortedItems = useMemo(
    () => [...checklist.items].sort((left, right) => compareChecklistItemPosition(left.position, right.position)),
    [checklist.items],
  );
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(checklist.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Keep titleDraft in sync when the prop changes (e.g. after server confirmation)
  useEffect(() => { setTitleDraft(checklist.title); }, [checklist.title]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  const handleTitleCommit = async () => {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === checklist.title) return;
    await onRename(trimmed);
  };

  const handleItemAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await onItemAdd(trimmed);
    setNewTitle('');
    setAdding(false);
  };

  const checked = sortedItems.filter((i: ChecklistItemType) => i.checked).length;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
    const newIndex = sortedItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sortedItems, oldIndex, newIndex);
    const movedItem = reordered[newIndex];
    if (!movedItem) return;

    const leftPosition = newIndex > 0 ? (reordered[newIndex - 1]?.position ?? LOW_SENTINEL) : LOW_SENTINEL;
    const rightPosition = newIndex < reordered.length - 1
      ? (reordered[newIndex + 1]?.position ?? HIGH_SENTINEL)
      : HIGH_SENTINEL;
    const position = betweenPositions(leftPosition, rightPosition);

    void onItemReorder(movedItem.id, position);
  };

  return (
    <section aria-label={`Checklist: ${checklist.title}`} className="space-y-1">
      {/* Title row */}
      <div className="flex items-center justify-between gap-2 mb-1">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="flex-1 rounded border border-border bg-bg-overlay px-2 py-0.5 text-sm font-semibold text-base focus:outline-none focus:ring-1 focus:ring-primary"
            value={titleDraft}
            onChange={(e) => { setTitleDraft(e.target.value); }}
            onBlur={() => { void handleTitleCommit(); }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') void handleTitleCommit();
              if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(checklist.title); }
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 whitespace-normal break-words text-left text-sm font-semibold text-base hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            onClick={() => { if (!disabled) setEditingTitle(true); }}
            title="Click to rename"
            disabled={disabled}
          >
            {checklist.title}
          </button>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {!disabled && (
            <>
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-0.5 text-xs"
                onClick={() => { setAdding((v) => !v); }}
              >
                + Item
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted hover:text-danger"
                onClick={() => { void onDelete(); }}
                title="Delete checklist"
                aria-label="Delete checklist"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {sortedItems.length > 0 && <ChecklistProgress total={sortedItems.length} checked={checked} />}

      <div className="mt-1 space-y-0.5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedItems.map((item: ChecklistItemType) => (
              <SortableChecklistItemRow
                key={item.id}
                item={item}
                onItemToggle={onItemToggle}
                onItemRename={onItemRename}
                onItemDelete={onItemDelete}
                onItemAssign={onItemAssign}
                onItemDueDateChange={onItemDueDateChange}
                onItemConvertToCard={onItemConvertToCard}
                boardMembers={boardMembers}
                {...(disabled === undefined ? {} : { disabled })}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded border border-border bg-bg-overlay px-2 py-1 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Add an item…"
            value={newTitle}
            onChange={(e) => { setNewTitle(e.target.value); }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') void handleItemAdd();
              if (e.key === 'Escape') setAdding(false);
            }}
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            className="px-3 py-1 text-sm"
            onClick={() => { void handleItemAdd(); }}
            disabled={!newTitle.trim()}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-sm text-muted hover:text-base"
            onClick={() => { setAdding(false); }}
          >
            Cancel
          </Button>
        </div>
      )}
    </section>
  );
};

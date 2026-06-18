// CardChecklist — renders all named checklist groups + "Add checklist" button.
// Each group is a ChecklistSection. Optimistic mutations handled in parent container.
import { useMemo, useState } from 'react';
import { PlusIcon, Bars3Icon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChecklistSection } from './ChecklistSection';
import { ChecklistItem } from './ChecklistItem';
import type { Checklist, ChecklistItem as ChecklistItemType } from '../api';
import Button from '../../../common/components/Button';
import type { Attachment } from '../../Attachments/types';
import translations from '../translations/en.json';

// Fractional position helpers — same algorithm as ChecklistSection item ordering.
const LOW_SENTINEL = '';
const HIGH_SENTINEL = '~';
const BASE = 95;

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

  if (
    left !== LOW_SENTINEL &&
    right !== HIGH_SENTINEL &&
    compareDigits(leftDigits, rightDigits) >= 0
  ) {
    return `${left}O`;
  }

  const output: number[] = [];
  let index = 0;

  for (;;) {
    const leftDigit = leftDigits[index] ?? 0;
    const rightDigit = rightDigits[index] ?? BASE - 1;

    if (rightDigit - leftDigit > 1) {
      output.push(Math.floor((leftDigit + rightDigit) / 2));
      break;
    }

    output.push(leftDigit);
    index += 1;
  }

  return fromDigits(output);
};

// [why] Positions in the DB may be large decimal number strings (Trello import format, e.g.
// "0140737488355328.000000"). betweenPositions uses a base-95 character algorithm which produces
// a shorter string that sorts numerically BELOW the left boundary — breaking reorder.
// This wrapper detects numeric positions and computes the arithmetic midpoint instead.
const computePositionBetween = (left: string, right: string): string => {
  const numLeft = left === LOW_SENTINEL ? 0 : Number(left);
  const numRight = right === HIGH_SENTINEL ? null : Number(right);

  if (Number.isFinite(numLeft)) {
    if (numRight !== null && Number.isFinite(numRight)) {
      return String((numLeft + numRight) / 2);
    }
    // Moving to the end: step past the last known position
    return String(numLeft + 65536);
  }

  return betweenPositions(left, right);
};

const comparePosition = (left: string, right: string): number => {
  if (left === right) return 0;
  const numericLeft = Number(left);
  const numericRight = Number(right);
  if (
    Number.isFinite(numericLeft) &&
    Number.isFinite(numericRight) &&
    numericLeft !== numericRight
  ) {
    return numericLeft - numericRight;
  }
  return left < right ? -1 : 1;
};

interface SortableChecklistRowProps {
  checklist: Checklist;
  isFirst: boolean;
  isLast: boolean;
  boardMembers: Array<{
    id: string;
    email: string;
    name: string | null;
    avatar_url?: string | null;
  }>;
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onItemAdd: (checklistId: string, title: string) => Promise<void>;
  onItemToggle: (checklistId: string, itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (checklistId: string, itemId: string, title: string) => Promise<void>;
  onItemDelete: (checklistId: string, itemId: string) => Promise<void>;
  onItemAssign: (checklistId: string, itemId: string, memberId: string | null) => Promise<void>;
  onItemDueDateChange: (
    checklistId: string,
    itemId: string,
    dueDate: string | null
  ) => Promise<void>;
  onItemConvertToCard: (checklistId: string, itemId: string) => Promise<void>;
  disabled?: boolean;
  attachments?: Attachment[];
}

const SortableChecklistRow = ({
  checklist,
  isFirst,
  isLast,
  boardMembers,
  onRenameChecklist,
  onDeleteChecklist,
  onMoveUp,
  onMoveDown,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  onItemAssign,
  onItemDueDateChange,
  onItemConvertToCard,
  disabled,
  attachments,
}: SortableChecklistRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `checklist:${checklist.id}`,
    data: {
      type: 'checklist',
      checklistId: checklist.id,
    },
    ...(disabled === undefined ? {} : { disabled }),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-60' : undefined}
    >
      <div className="flex items-start gap-1.5">
        {!disabled && (
          // [why] Controls column is pinned to the top so icons align with the checklist title row
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              type="button"
              className="cursor-grab text-muted hover:text-subtle active:cursor-grabbing focus:outline-none"
              aria-label={translations['card.checklist.dragHandleAria']}
            >
              <Bars3Icon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={isFirst}
              onClick={onMoveUp}
              className="text-muted hover:text-subtle disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
              aria-label={translations['card.checklist.moveUpAria']}
            >
              <ChevronUpIcon className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={onMoveDown}
              className="text-muted hover:text-subtle disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
              aria-label={translations['card.checklist.moveDownAria']}
            >
              <ChevronDownIcon className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <ChecklistSection
            checklist={checklist}
            onRename={(title) => onRenameChecklist(checklist.id, title)}
            onDelete={() => onDeleteChecklist(checklist.id)}
            onItemAdd={(title) => onItemAdd(checklist.id, title)}
            onItemToggle={(itemId, checked) => onItemToggle(checklist.id, itemId, checked)}
            onItemRename={(itemId, title) => onItemRename(checklist.id, itemId, title)}
            onItemDelete={(itemId) => onItemDelete(checklist.id, itemId)}
            onItemAssign={(itemId, memberId) => onItemAssign(checklist.id, itemId, memberId)}
            onItemDueDateChange={(itemId, dueDate) =>
              onItemDueDateChange(checklist.id, itemId, dueDate)
            }
            onItemConvertToCard={(itemId) => onItemConvertToCard(checklist.id, itemId)}
            boardMembers={boardMembers}
            {...(disabled === undefined ? {} : { disabled })}
            {...(attachments === undefined ? {} : { attachments })}
          />
        </div>
      </div>
    </div>
  );
};

interface Props {
  checklists: Checklist[];
  boardMembers: Array<{
    id: string;
    email: string;
    name: string | null;
    avatar_url?: string | null;
  }>;
  onCreateChecklist: (title?: string) => Promise<void>;
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onChecklistReorder: (checklistId: string, position: string) => Promise<void>;
  onItemAdd: (checklistId: string, title: string) => Promise<void>;
  onItemToggle: (checklistId: string, itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (checklistId: string, itemId: string, title: string) => Promise<void>;
  onItemDelete: (checklistId: string, itemId: string) => Promise<void>;
  onItemAssign: (checklistId: string, itemId: string, memberId: string | null) => Promise<void>;
  onItemDueDateChange: (
    checklistId: string,
    itemId: string,
    dueDate: string | null
  ) => Promise<void>;
  onItemConvertToCard: (checklistId: string, itemId: string) => Promise<void>;
  onItemReorder: (
    sourceChecklistId: string,
    itemId: string,
    position: string,
    targetChecklistId?: string
  ) => Promise<void>;
  disabled?: boolean;
  /** Attachments for the card — forwarded to checklist items to enable attachment-reference previews. */
  attachments?: Attachment[];
}

type DragMeta = { type?: string; checklistId?: string; itemId?: string };

const reorderWithinChecklist = ({
  sourceChecklistId,
  movedItemId,
  sourceItems,
  sourceIndex,
  overType,
  targetItemId,
  onItemReorder,
}: {
  sourceChecklistId: string;
  movedItemId: string;
  sourceItems: Array<{ id: string; position: string }>;
  sourceIndex: number;
  overType?: string;
  targetItemId: string | null;
  onItemReorder: (
    sourceChecklistId: string,
    itemId: string,
    position: string,
    targetChecklistId?: string
  ) => Promise<void>;
}): void => {
  const newIndex =
    overType === 'checklist-dropzone'
      ? sourceItems.length - 1
      : sourceItems.findIndex((item) => item.id === targetItemId);
  if (newIndex < 0 || newIndex === sourceIndex) return;

  const reordered = arrayMove(sourceItems, sourceIndex, newIndex);
  const leftPosition =
    newIndex > 0 ? (reordered[newIndex - 1]?.position ?? LOW_SENTINEL) : LOW_SENTINEL;
  const rightPosition =
    newIndex < reordered.length - 1
      ? (reordered[newIndex + 1]?.position ?? HIGH_SENTINEL)
      : HIGH_SENTINEL;
  const position = computePositionBetween(leftPosition, rightPosition);
  void onItemReorder(sourceChecklistId, movedItemId, position, sourceChecklistId);
};

const handleChecklistItemDrop = ({
  orderedChecklists,
  activeMeta,
  overMeta,
  activeId,
  overType,
  onItemReorder,
}: {
  orderedChecklists: Checklist[];
  activeMeta: DragMeta;
  overMeta: DragMeta;
  activeId: string;
  overType?: string;
  onItemReorder: (
    sourceChecklistId: string,
    itemId: string,
    position: string,
    targetChecklistId?: string
  ) => Promise<void>;
}): void => {
  const sourceChecklistId = activeMeta.checklistId;
  const movedItemId = activeMeta.itemId ?? activeId;
  const targetChecklistId = overMeta.checklistId;
  const targetItemId = overType === 'checklist-item' ? (overMeta.itemId ?? null) : null;
  if (!sourceChecklistId || !movedItemId || !targetChecklistId) return;

  const sourceChecklist = orderedChecklists.find((checklist) => checklist.id === sourceChecklistId);
  const targetChecklist = orderedChecklists.find((checklist) => checklist.id === targetChecklistId);
  const sourceItem = sourceChecklist?.items.find((item) => item.id === movedItemId);
  if (!sourceChecklist || !targetChecklist || !sourceItem) return;

  const sourceItems = [...sourceChecklist.items].sort((left, right) =>
    comparePosition(left.position, right.position)
  );
  const sourceIndex = sourceItems.findIndex((item) => item.id === movedItemId);
  if (sourceIndex < 0) return;

  if (sourceChecklistId === targetChecklistId) {
    reorderWithinChecklist({
      sourceChecklistId,
      movedItemId,
      sourceItems,
      sourceIndex,
      overType,
      targetItemId,
      onItemReorder,
    });
    return;
  }

  const targetItems = [...targetChecklist.items]
    .filter((item) => item.id !== movedItemId)
    .sort((left, right) => comparePosition(left.position, right.position));
  const insertionIndex =
    overType === 'checklist-item'
      ? targetItems.findIndex((item) => item.id === targetItemId)
      : targetItems.length;
  const normalizedInsertionIndex = insertionIndex >= 0 ? insertionIndex : targetItems.length;

  const withMoved = [...targetItems];
  withMoved.splice(normalizedInsertionIndex, 0, sourceItem);
  const leftPosition =
    normalizedInsertionIndex > 0
      ? (withMoved[normalizedInsertionIndex - 1]?.position ?? LOW_SENTINEL)
      : LOW_SENTINEL;
  const rightPosition =
    normalizedInsertionIndex < withMoved.length - 1
      ? (withMoved[normalizedInsertionIndex + 1]?.position ?? HIGH_SENTINEL)
      : HIGH_SENTINEL;
  const position = computePositionBetween(leftPosition, rightPosition);
  void onItemReorder(sourceChecklistId, movedItemId, position, targetChecklistId);
};

const handleChecklistDrop = ({
  orderedChecklists,
  activeMeta,
  overMeta,
  onChecklistReorder,
}: {
  orderedChecklists: Checklist[];
  activeMeta: DragMeta;
  overMeta: DragMeta;
  onChecklistReorder: (checklistId: string, position: string) => Promise<void>;
}): void => {
  const activeChecklistId = activeMeta.checklistId;
  const targetChecklistId = overMeta.checklistId;
  if (!activeChecklistId || !targetChecklistId || activeChecklistId === targetChecklistId) return;

  const oldIndex = orderedChecklists.findIndex((cl) => cl.id === activeChecklistId);
  const newIndex = orderedChecklists.findIndex((cl) => cl.id === targetChecklistId);
  if (oldIndex < 0 || newIndex < 0) return;

  const reordered = arrayMove(orderedChecklists, oldIndex, newIndex);
  const moved = reordered[newIndex];
  if (!moved) return;

  const leftPosition =
    newIndex > 0 ? (reordered[newIndex - 1]?.position ?? LOW_SENTINEL) : LOW_SENTINEL;
  const rightPosition =
    newIndex < reordered.length - 1
      ? (reordered[newIndex + 1]?.position ?? HIGH_SENTINEL)
      : HIGH_SENTINEL;
  const position = computePositionBetween(leftPosition, rightPosition);
  void onChecklistReorder(moved.id, position);
};

const CardChecklist = ({
  checklists,
  boardMembers,
  onCreateChecklist,
  onRenameChecklist,
  onDeleteChecklist,
  onChecklistReorder,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  onItemAssign,
  onItemDueDateChange,
  onItemConvertToCard,
  onItemReorder,
  disabled,
  attachments,
}: Props) => {
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  // [why] Track the active drag item so DragOverlay can render a floating copy
  // that follows the cursor. Without this, checklist items become invisible when
  // dragged across different SortableContext containers (different checklists)
  // because useSortable's transform is relative to the original container.
  const [activeDragItem, setActiveDragItem] = useState<ChecklistItemType | null>(null);

  const orderedChecklists = useMemo(
    () => [...checklists].sort((left, right) => comparePosition(left.position, right.position)),
    [checklists]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreateChecklist = async () => {
    const trimmed = newChecklistTitle.trim() || undefined;
    setAddingChecklist(false);
    setNewChecklistTitle('');
    await onCreateChecklist(trimmed);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const cl = orderedChecklists[index];
    if (!cl) return;
    const leftPos =
      index > 1 ? (orderedChecklists[index - 2]?.position ?? LOW_SENTINEL) : LOW_SENTINEL;
    const rightPos = orderedChecklists[index - 1]?.position ?? LOW_SENTINEL;
    void onChecklistReorder(cl.id, computePositionBetween(leftPos, rightPos));
  };

  const handleMoveDown = (index: number) => {
    if (index >= orderedChecklists.length - 1) return;
    const cl = orderedChecklists[index];
    if (!cl) return;
    const leftPos = orderedChecklists[index + 1]?.position ?? HIGH_SENTINEL;
    const rightPos =
      index < orderedChecklists.length - 2
        ? (orderedChecklists[index + 2]?.position ?? HIGH_SENTINEL)
        : HIGH_SENTINEL;
    void onChecklistReorder(cl.id, computePositionBetween(leftPos, rightPos));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const meta = (active.data.current as DragMeta | undefined) ?? {};
    if (meta.type !== 'checklist-item') return;

    const checklistId = meta.checklistId;
    const itemId = meta.itemId ?? String(active.id);
    if (!checklistId || !itemId) return;

    const checklist = orderedChecklists.find((cl) => cl.id === checklistId);
    const item = checklist?.items.find((i) => i.id === itemId);
    if (!item) return;

    setActiveDragItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeMeta = (active.data.current as DragMeta | undefined) ?? {};
    const overMeta = (over.data.current as DragMeta | undefined) ?? {};

    if (activeMeta.type === 'checklist-item') {
      handleChecklistItemDrop({
        orderedChecklists,
        activeMeta,
        overMeta,
        activeId: String(active.id),
        overType: overMeta.type,
        onItemReorder,
      });
      return;
    }

    if (activeMeta.type !== 'checklist') return;

    handleChecklistDrop({
      orderedChecklists,
      activeMeta,
      overMeta,
      onChecklistReorder,
    });
  };

  if (checklists.length === 0 && disabled) return null;

  return (
    <section aria-label={translations['card.checklist.sectionAria']}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Checklists</h3>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => {
              setAddingChecklist((v) => !v);
            }}
          >
            <PlusIcon className="h-3 w-3" />
            Add checklist
          </Button>
        )}
      </div>

      {addingChecklist && (
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded border border-border bg-bg-overlay px-2 py-1 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={translations['card.checklist.titlePlaceholder']}
            value={newChecklistTitle}
            onChange={(e) => {
              setNewChecklistTitle(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateChecklist();
              if (e.key === 'Escape') {
                setAddingChecklist(false);
                setNewChecklistTitle('');
              }
            }}
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => {
              void handleCreateChecklist();
            }}
          >
            Create
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAddingChecklist(false);
              setNewChecklistTitle('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedChecklists.map((cl) => `checklist:${cl.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {orderedChecklists.map((cl, index) => (
              <SortableChecklistRow
                key={cl.id}
                checklist={cl}
                isFirst={index === 0}
                isLast={index === orderedChecklists.length - 1}
                boardMembers={boardMembers}
                onRenameChecklist={onRenameChecklist}
                onDeleteChecklist={onDeleteChecklist}
                onMoveUp={() => {
                  handleMoveUp(index);
                }}
                onMoveDown={() => {
                  handleMoveDown(index);
                }}
                onItemAdd={onItemAdd}
                onItemToggle={onItemToggle}
                onItemRename={onItemRename}
                onItemDelete={onItemDelete}
                onItemAssign={onItemAssign}
                onItemDueDateChange={onItemDueDateChange}
                onItemConvertToCard={onItemConvertToCard}
                {...(disabled === undefined ? {} : { disabled })}
                {...(attachments === undefined ? {} : { attachments })}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeDragItem && (
            <div className="opacity-90">
              <ChecklistItem
                item={activeDragItem}
                onToggle={async () => {}}
                onRename={async () => {}}
                onDelete={async () => {}}
                onAssign={async () => {}}
                onDueDateChange={async () => {}}
                onConvertToCard={async () => {}}
                boardMembers={boardMembers}
                showDragHandle
                {...(attachments === undefined ? {} : { attachments })}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </section>
  );
};

export default CardChecklist;

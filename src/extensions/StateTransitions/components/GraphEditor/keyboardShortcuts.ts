import { useEffect } from 'react';

interface Args {
  enabled: boolean;
  scopeElement: HTMLElement | null;
  onDelete: () => void;
  onUndo: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
}

export type GraphEditorShortcutAction = 'escape' | 'delete' | 'undo' | 'select-all' | null;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export function getGraphEditorShortcutAction({
  event,
  scopeElement,
}: {
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'target'>;
  scopeElement: HTMLElement | null;
}): GraphEditorShortcutAction {
  const target = event.target;
  if (scopeElement && target instanceof Node && !scopeElement.contains(target)) {
    return null;
  }

  if (event.key === 'Escape') {
    return 'escape';
  }

  if (isEditableTarget(target)) {
    return null;
  }

  const normalized = event.key.toLowerCase();

  if (event.key === 'Delete' || event.key === 'Backspace') {
    return 'delete';
  }

  if ((event.metaKey || event.ctrlKey) && normalized === 'z') {
    return 'undo';
  }

  if ((event.metaKey || event.ctrlKey) && normalized === 'a') {
    return 'select-all';
  }

  return null;
}

export const useGraphEditorKeyboardShortcuts = ({
  enabled,
  scopeElement,
  onDelete,
  onUndo,
  onSelectAll,
  onEscape,
}: Args) => {
  useEffect(() => {
    if (!enabled || !scopeElement) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const action = getGraphEditorShortcutAction({ event, scopeElement });
      if (action === null) return;
      event.preventDefault();
      switch (action) {
        case 'escape':
          onEscape();
          break;
        case 'delete':
          onDelete();
          break;
        case 'undo':
          onUndo();
          break;
        case 'select-all':
          onSelectAll();
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, onDelete, onEscape, onSelectAll, onUndo, scopeElement]);
};

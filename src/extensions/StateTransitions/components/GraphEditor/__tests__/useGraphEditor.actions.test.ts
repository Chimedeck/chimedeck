import { describe, expect, it } from 'bun:test';
import type { HistorySnapshot } from '../useGraphEditor';
import {
  UNDO_STACK_LIMIT,
  createColumnGraphNode,
  createStickyNoteGraphNode,
  pushUndoSnapshotWithLimit,
} from '../useGraphEditor';

function makeSnapshot(index: number): HistorySnapshot {
  return {
    nodes: [],
    edges: [],
    selectedEdgeId: `edge-${String(index)}`,
  };
}

describe('useGraphEditor action helpers', () => {
  it('creates sticky note nodes in editing mode', () => {
    const sticky = createStickyNoteGraphNode({ id: 'note-1', x: 40, y: 80 });
    expect(sticky.id).toBe('note-1');
    expect(sticky.type).toBe('stickyNoteNode');
    expect(sticky.position).toEqual({ x: 40, y: 80 });
    expect(sticky.data.noteId).toBe('note-1');
    expect(sticky.data.isEditing).toBe(true);
    expect(sticky.data.noteContent).toBe('');
  });

  it('creates column graph nodes with list binding', () => {
    const column = createColumnGraphNode({ id: 'list-1', title: 'In Progress', x: 120, y: 220 });
    expect(column.id).toBe('list-1');
    expect(column.type).toBe('columnNode');
    expect(column.position).toEqual({ x: 120, y: 220 });
    expect(column.data.label).toBe('In Progress');
    expect(column.data.listId).toBe('list-1');
  });

  it('caps undo snapshots to 20 entries', () => {
    let history: HistorySnapshot[] = [];
    for (let index = 1; index <= UNDO_STACK_LIMIT + 5; index += 1) {
      history = pushUndoSnapshotWithLimit(history, makeSnapshot(index), UNDO_STACK_LIMIT);
    }

    expect(history).toHaveLength(UNDO_STACK_LIMIT);
    expect(history[0]?.selectedEdgeId).toBe('edge-6');
    expect(history[UNDO_STACK_LIMIT - 1]?.selectedEdgeId).toBe('edge-25');
  });
});

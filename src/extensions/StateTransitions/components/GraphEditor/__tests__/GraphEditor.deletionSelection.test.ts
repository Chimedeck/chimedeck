import { describe, expect, it } from 'bun:test';
import { buildPendingColumnDeletionSelection } from '../index';

describe('GraphEditor deletion selection helper', () => {
  it('returns null when there is no column node in selection', () => {
    const selection = buildPendingColumnDeletionSelection({
      selectedNodes: [{ id: 'note-1', type: 'stickyNoteNode', data: { label: 'Note' } }],
      selectedEdges: [{ id: 'edge-1' }],
    });

    expect(selection).toBeNull();
  });

  it('builds pending deletion payload for selected column nodes', () => {
    const selection = buildPendingColumnDeletionSelection({
      selectedNodes: [
        { id: 'list-1', type: 'columnNode', data: { label: 'In Progress' } },
        { id: 'note-1', type: 'stickyNoteNode', data: {} },
      ],
      selectedEdges: [{ id: 'edge-1' }],
    });

    expect(selection).toEqual({
      nodeIds: ['list-1', 'note-1'],
      edgeIds: ['edge-1'],
      listNodeIds: ['list-1'],
      listTitles: ['In Progress'],
    });
  });
});

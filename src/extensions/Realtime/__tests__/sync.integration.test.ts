// Integration-style test: two simulated clients (two dispatch functions)
// receiving the same board events must converge to the same list/card state.
// Uses listSlice and cardSlice reducers directly — no network or configureStore needed.
import { describe, it, expect } from 'bun:test';
import listReducer, { listSliceActions } from '../../List/listSlice';
import cardReducer, { cardSliceActions } from '../../Card/cardSlice';
import type { List } from '../../List/api';
import type { Card } from '../../Card/api';
import type { ListsState } from '../../List/listSlice';
import type { CardsState } from '../../Card/cardSlice';

// ---------- Minimal store helpers (no redux dependency) ----------

function makeListStore() {
  let state = listReducer(undefined, { type: '@@INIT' });
  const dispatch = (action: { type: string; payload?: unknown }) => {
    state = listReducer(state, action as Parameters<typeof listReducer>[1]);
  };
  const getState = (): ListsState => state;
  return { dispatch, getState };
}

function makeCardStore() {
  let state = cardReducer(undefined, { type: '@@INIT' });
  const dispatch = (action: { type: string; payload?: unknown }) => {
    state = cardReducer(state, action as Parameters<typeof cardReducer>[1]);
  };
  const getState = (): CardsState => state;
  return { dispatch, getState };
}

const listA: List = { id: 'l1', boardId: 'b1', title: 'To Do', position: '1', archived: false };
const listB: List = { id: 'l2', boardId: 'b1', title: 'Done', position: '2', archived: false };

const card1: Card = {
  id: 'c1', list_id: 'l1', title: 'Card 1', description: null,
  position: '1', archived: false, due_date: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

describe('Realtime state convergence (integration)', () => {
  it('two clients converge to same list state after remoteCreate events', () => {
    const clientA = makeListStore();
    const clientB = makeListStore();

    clientA.dispatch(listSliceActions.remoteCreate({ list: listA }));
    clientA.dispatch(listSliceActions.remoteCreate({ list: listB }));

    clientB.dispatch(listSliceActions.remoteCreate({ list: listA }));
    clientB.dispatch(listSliceActions.remoteCreate({ list: listB }));

    expect(clientA.getState().byId).toEqual(clientB.getState().byId);
  });

  it('two clients converge after remoteReorder', () => {
    const clientA = makeListStore();
    const clientB = makeListStore();

    for (const store of [clientA, clientB]) {
      store.dispatch(listSliceActions.remoteCreate({ list: listA }));
      store.dispatch(listSliceActions.remoteCreate({ list: listB }));
    }

    const reorderedLists = [
      { ...listB, position: '1' },
      { ...listA, position: '2' },
    ];

    clientA.dispatch(listSliceActions.remoteReorder({ boardId: 'b1', lists: reorderedLists }));
    clientB.dispatch(listSliceActions.remoteReorder({ boardId: 'b1', lists: reorderedLists }));

    expect(clientA.getState().orderByBoard['b1']).toEqual(
      clientB.getState().orderByBoard['b1'],
    );
  });

  it('optimistic card move rolls back correctly on error', () => {
    const store = makeCardStore();
    store.dispatch(cardSliceActions.hydrate({ cards: [card1] }));
    expect(store.getState().byId['c1']?.list_id).toBe('l1');

    // Apply optimistic move to list l2
    store.dispatch(
      cardSliceActions.applyOptimisticMove({
        mutationId: 'mut-1',
        cardId: 'c1',
        fromListId: 'l1',
        toListId: 'l2',
        afterCardId: null,
      }),
    );
    expect(store.getState().byId['c1']?.list_id).toBe('l2');

    // Rollback
    store.dispatch(cardSliceActions.rollbackOptimisticMove({ mutationId: 'mut-1' }));
    expect(store.getState().byId['c1']?.list_id).toBe('l1');
  });

  it('deduplication: applying the same remoteUpdate twice does not corrupt state', () => {
    const store = makeCardStore();
    store.dispatch(cardSliceActions.hydrate({ cards: [card1] }));

    const updated = { ...card1, title: 'Updated Title' };
    store.dispatch(cardSliceActions.remoteUpdate({ card: updated }));
    store.dispatch(cardSliceActions.remoteUpdate({ card: updated })); // duplicate

    expect(store.getState().byId['c1']?.title).toBe('Updated Title');
    // Count should not double
    const listCards = store.getState().orderByList['l1'] ?? [];
    expect(listCards.filter((id) => id === 'c1').length).toBe(1);
  });

  it('two clients converge after remoteMove event', () => {
    const clientA = makeCardStore();
    const clientB = makeCardStore();

    for (const store of [clientA, clientB]) {
      store.dispatch(cardSliceActions.hydrate({ cards: [card1] }));
    }

    const movedCard: Card = { ...card1, list_id: 'l2', position: '1' };

    clientA.dispatch(cardSliceActions.remoteMove({ card: movedCard, fromListId: 'l1' }));
    clientB.dispatch(cardSliceActions.remoteMove({ card: movedCard, fromListId: 'l1' }));

    expect(clientA.getState().byId['c1']?.list_id).toBe('l2');
    expect(clientB.getState().byId['c1']?.list_id).toBe('l2');
  });
});

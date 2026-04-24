import { describe, expect, it } from 'bun:test';
import {
  getAdjustedPointerY,
  shouldRecomputeFromPointerDestination,
} from './dragPlacementUtils';

describe('dragPlacementUtils', () => {
  describe('getAdjustedPointerY', () => {
    it('applies positive vertical scroll delta', () => {
      expect(getAdjustedPointerY({ pointerY: 210, verticalScrollDelta: 100 })).toBe(310);
    });

    it('applies negative vertical scroll delta', () => {
      expect(getAdjustedPointerY({ pointerY: 210, verticalScrollDelta: -40 })).toBe(170);
    });

    it('returns null when pointerY is null', () => {
      expect(getAdjustedPointerY({ pointerY: null, verticalScrollDelta: 80 })).toBeNull();
    });

    it('returns pointer unchanged when delta is invalid', () => {
      expect(getAdjustedPointerY({ pointerY: 210, verticalScrollDelta: Number.NaN })).toBe(210);
    });
  });

  describe('shouldRecomputeFromPointerDestination', () => {
    it('recomputes when placeholder is missing and pointer is over a different valid list', () => {
      const shouldRecompute = shouldRecomputeFromPointerDestination({
        disableLiveDragPreview: true,
        pointerListId: 'list-b',
        pointerListExists: true,
        fromListId: 'list-a',
        resolvedToListId: 'list-a',
        resolvedFromPlaceholder: false,
      });
      expect(shouldRecompute).toBe(true);
    });

    it('does not recompute when pointer list equals source list', () => {
      const shouldRecompute = shouldRecomputeFromPointerDestination({
        disableLiveDragPreview: true,
        pointerListId: 'list-a',
        pointerListExists: true,
        fromListId: 'list-a',
        resolvedToListId: 'list-a',
        resolvedFromPlaceholder: false,
      });
      expect(shouldRecompute).toBe(false);
    });

    it('does not recompute when placeholder already matches pointer-resolved destination', () => {
      const shouldRecompute = shouldRecomputeFromPointerDestination({
        disableLiveDragPreview: true,
        pointerListId: 'list-b',
        pointerListExists: true,
        fromListId: 'list-a',
        resolvedToListId: 'list-b',
        resolvedFromPlaceholder: true,
      });
      expect(shouldRecompute).toBe(false);
    });

    it('recomputes when placeholder destination conflicts with pointer-resolved destination', () => {
      const shouldRecompute = shouldRecomputeFromPointerDestination({
        disableLiveDragPreview: true,
        pointerListId: 'list-c',
        pointerListExists: true,
        fromListId: 'list-a',
        resolvedToListId: 'list-b',
        resolvedFromPlaceholder: true,
      });
      expect(shouldRecompute).toBe(true);
    });

    it('does not recompute when pointer list is unknown', () => {
      const shouldRecompute = shouldRecomputeFromPointerDestination({
        disableLiveDragPreview: true,
        pointerListId: 'list-b',
        pointerListExists: false,
        fromListId: 'list-a',
        resolvedToListId: 'list-a',
        resolvedFromPlaceholder: false,
      });
      expect(shouldRecompute).toBe(false);
    });
  });
});

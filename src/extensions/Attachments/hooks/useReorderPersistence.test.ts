// useReorderPersistence.test.ts — unit tests for the serialized optimistic-reorder
// persistence hook (extracted from AttachmentPanel for testability, mirroring the
// validateReorderOrder extraction).
//
// Covers the copilot thread PRRT_kwDOR8tw586pSX8i fix:
// - reorder calls are serialized (older send cannot finish after a newer one);
// - only the LATEST failed reorder toasts + triggers the rollback reload — a
//   failed older reorder is silent because a newer order already replaced it;
// - every persistReorder call bumps the shared reorder epoch SYNCHRONOUSLY so
//   an in-flight list fetch discards its pre-reorder snapshot (the failed
//   reorder's rollback reload can no longer clobber a newer committed order);
// - success reconciles state from the reorder endpoint's returned list.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReorderPersistence } from './useReorderPersistence';
import { reorderAttachments } from '../api';
import type { Attachment } from '../types';

vi.mock('../api', () => ({
  reorderAttachments: vi.fn(),
}));

function makeAttachment(id: string, position: string | null): Attachment {
  return {
    id,
    card_id: 'card-1',
    name: id,
    alias: null,
    type: 'FILE',
    status: 'READY',
    key: null,
    thumbnail_key: null,
    content_type: null,
    size_bytes: null,
    width: null,
    height: null,
    view_url: null,
    thumbnail_url: null,
    external_url: null,
    referenced_card_id: null,
    referenced_card: null,
    position,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

interface Harness {
  attachmentsRef: { current: Attachment[] };
  reorderEpochRef: { current: number };
  setAttachments: ReturnType<typeof vi.fn>;
  pushErrorToast: ReturnType<typeof vi.fn>;
  loadAttachments: ReturnType<typeof vi.fn>;
  persist: (order: string[]) => Promise<void>;
}

function renderHarness(initial: Attachment[]): Harness {
  const attachmentsRef = { current: initial };
  const reorderEpochRef = { current: 0 };
  const setAttachments = vi.fn((next: Attachment[]) => {
    attachmentsRef.current = next;
  });
  const pushErrorToast = vi.fn();
  const loadAttachments = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useReorderPersistence({
      cardId: 'card-1',
      attachmentsRef: attachmentsRef as React.MutableRefObject<Attachment[]>,
      setAttachments: setAttachments as unknown as (next: Attachment[]) => void,
      pushErrorToast: pushErrorToast as unknown as (message: string) => void,
      loadAttachments: loadAttachments as unknown as () => Promise<void>,
      reorderEpochRef: reorderEpochRef as React.MutableRefObject<number>,
    })
  );
  return {
    attachmentsRef,
    reorderEpochRef,
    setAttachments,
    pushErrorToast,
    loadAttachments,
    persist: (order: string[]) => result.current(order),
  };
}

describe('useReorderPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes reorder sends: a newer call waits for the older one to settle', async () => {
    const h = renderHarness([makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')]);

    let resolveFirst!: (v: { data: Attachment[] }) => void;
    vi.mocked(reorderAttachments).mockImplementationOnce(
      () =>
        new Promise<{ data: Attachment[] }>((res) => {
          resolveFirst = res;
        })
    );
    vi.mocked(reorderAttachments).mockImplementationOnce(async () => ({
      data: [makeAttachment('b', 'aaa'), makeAttachment('a', 'bbb')],
    }));

    let firstOrderSentButStillPending: boolean | undefined;
    await act(async () => {
      const first = h.persist(['b', 'a']);
      const second = h.persist(['a', 'b']);
      // While the first POST is pending, the second must NOT have been sent yet.
      firstOrderSentButStillPending = vi.mocked(reorderAttachments).mock.calls.length === 1;
      resolveFirst({ data: [makeAttachment('b', 'aaa'), makeAttachment('a', 'bbb')] });
      await Promise.all([first, second]);
    });

    expect(firstOrderSentButStillPending).toBe(true);
    expect(vi.mocked(reorderAttachments)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(reorderAttachments).mock.calls[0]?.[0]).toEqual({
      cardId: 'card-1',
      order: ['b', 'a'],
    });
    expect(vi.mocked(reorderAttachments).mock.calls[1]?.[0]).toEqual({
      cardId: 'card-1',
      order: ['a', 'b'],
    });
  });

  it('reconciles state from the reorder response (latest order wins)', async () => {
    const h = renderHarness([makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')]);
    const serverList = [makeAttachment('b', 'aaa'), makeAttachment('a', 'bbb')];
    vi.mocked(reorderAttachments).mockResolvedValueOnce({ data: serverList });

    await act(async () => {
      await h.persist(['b', 'a']);
    });

    expect(h.setAttachments).toHaveBeenCalledWith(serverList);
    expect(h.attachmentsRef.current).toEqual(serverList);
    expect(h.pushErrorToast).not.toHaveBeenCalled();
    expect(h.loadAttachments).not.toHaveBeenCalled();
  });

  it('supersedes an older failed reorder: no toast, no rollback reload, no state write', async () => {
    const h = renderHarness([makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')]);

    let rejectFirst!: (e: unknown) => void;
    vi.mocked(reorderAttachments).mockImplementationOnce(
      () =>
        new Promise<{ data: Attachment[] }>((_, rej) => {
          rejectFirst = rej;
        })
    );
    vi.mocked(reorderAttachments).mockImplementationOnce(async () => ({
      data: [makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')],
    }));

    await act(async () => {
      const first = h.persist(['b', 'a']);
      const second = h.persist(['a', 'b']);
      rejectFirst(new Error('first reorder failed (superseded)'));
      await Promise.all([first, second]);
    });

    // The older failure is silent: a newer reorder already owns the order.
    expect(h.pushErrorToast).not.toHaveBeenCalled();
    expect(h.loadAttachments).not.toHaveBeenCalled();
    // The newer call reconciles from its own response.
    expect(h.setAttachments).toHaveBeenCalledTimes(1);
  });

  it('latest failed reorder toasts + triggers the rollback reload', async () => {
    const h = renderHarness([makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')]);
    vi.mocked(reorderAttachments).mockRejectedValueOnce(new Error('network down'));

    let task: Promise<void> = Promise.resolve();
    await act(async () => {
      task = h.persist(['b', 'a']);
    });
    await act(async () => {
      await task;
    });

    expect(h.pushErrorToast).toHaveBeenCalledTimes(1);
    expect(h.loadAttachments).toHaveBeenCalledTimes(1);
    expect(h.setAttachments).not.toHaveBeenCalled();
  });

  it('bumps the shared reorder epoch synchronously on every call — including failing ones', async () => {
    const h = renderHarness([makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')]);

    // Contract for loadAttachments: a load that started before a reorder must see
    // the epoch move and discard its pre-reorder snapshot. The bump must be
    // visible BEFORE the reorder's network call settles (no await in between).
    const epochAtLoadStart = h.reorderEpochRef.current;
    vi.mocked(reorderAttachments).mockResolvedValueOnce({
      data: [makeAttachment('b', 'aaa'), makeAttachment('a', 'bbb')],
    });
    await act(async () => {
      const task = h.persist(['b', 'a']);
      expect(h.reorderEpochRef.current).toBe(epochAtLoadStart + 1);
      await task;
    });

    // Failing calls bump too (their rollback reload re-snapshots AFTER the bump).
    vi.mocked(reorderAttachments).mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      await h.persist(['a', 'b']);
    });
    expect(h.reorderEpochRef.current).toBe(epochAtLoadStart + 2);
  });

  it('clears the in-flight slot after the latest task settles so later calls send immediately', async () => {
    const h = renderHarness([makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')]);
    vi.mocked(reorderAttachments).mockResolvedValue({
      data: [makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')],
    });

    await act(async () => {
      await h.persist(['b', 'a']);
    });
    await act(async () => {
      await h.persist(['a', 'b']);
    });

    // No serialization deadlock: both calls sent without waiting on a stale slot.
    expect(vi.mocked(reorderAttachments)).toHaveBeenCalledTimes(2);
  });

  it('propagates the endpoint response list through the ref for subsequent drag reads', async () => {
    const h = renderHarness([makeAttachment('a', 'aaa'), makeAttachment('b', 'bbb')]);
    const serverList = [makeAttachment('b', 'aaa'), makeAttachment('a', 'bbb')];
    vi.mocked(reorderAttachments).mockResolvedValueOnce({ data: serverList });

    await act(async () => {
      await h.persist(['b', 'a']);
    });
    await waitFor(() => {
      expect(h.attachmentsRef.current.map((a) => a.id)).toEqual(['b', 'a']);
    });
  });
});

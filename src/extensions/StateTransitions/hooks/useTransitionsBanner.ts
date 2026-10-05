import { useCallback, useEffect, useMemo, useState } from 'react';

export function getTransitionsBannerSessionKey(boardId: string): string {
  return `state-transitions-banner-dismissed-${boardId}`;
}

export function isTransitionsBannerDismissed({
  boardId,
  storage,
}: {
  boardId: string;
  storage: Storage | null;
}): boolean {
  if (!storage) return false;
  return storage.getItem(getTransitionsBannerSessionKey(boardId)) === '1';
}

export function useTransitionsBanner({ boardId, enabled }: { boardId: string; enabled: boolean }) {
  const storage = useMemo(() => {
    try {
      return globalThis.sessionStorage;
    } catch {
      return null;
    }
  }, []);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || boardId.trim().length === 0) {
      setDismissed(false);
      return;
    }
    setDismissed(isTransitionsBannerDismissed({ boardId, storage }));
  }, [boardId, enabled, storage]);

  const dismiss = useCallback(() => {
    if (!storage || boardId.trim().length === 0) return;
    storage.setItem(getTransitionsBannerSessionKey(boardId), '1');
    setDismissed(true);
  }, [boardId, storage]);

  return {
    isVisible: enabled && boardId.trim().length > 0 && !dismissed,
    dismiss,
  };
}

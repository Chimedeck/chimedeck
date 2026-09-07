import { describe, expect, it } from 'bun:test';
import {
  getTransitionsBannerSessionKey,
  isTransitionsBannerDismissed,
} from '../useTransitionsBanner';

describe('useTransitionsBanner helpers', () => {
  it('builds board-scoped sessionStorage keys', () => {
    expect(getTransitionsBannerSessionKey('board-123')).toBe('state-transitions-banner-dismissed-board-123');
  });

  it('reads dismissal from session storage key', () => {
    const storage = {
      getItem: (key: string) => (key === 'state-transitions-banner-dismissed-board-123' ? '1' : null),
    } as unknown as Storage;
    expect(isTransitionsBannerDismissed({ boardId: 'board-123', storage })).toBe(true);
    expect(isTransitionsBannerDismissed({ boardId: 'board-456', storage })).toBe(false);
  });
});

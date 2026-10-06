// ActivityItem.branchLabel.test.tsx — regression coverage for the
// board_github_branch_updated activity rendering (copilot thread
// PRRT_kwDOR8tw586pSX8H): a CLEARED branch override persists payload.next === null
// and previously rendered "changed the GitHub branch scope to " with an empty
// label; it must render an explicit default-branch label instead.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityItem from '../ActivityItem';
import type { Activity } from '../ActivityItem';

const baseActivity: Activity = {
  id: 'act-1',
  entity_type: 'board',
  entity_id: 'board-1',
  board_id: 'board-1',
  action: 'board_github_branch_updated',
  actor_id: 'user-1',
  payload: {},
  created_at: '2026-10-06T00:00:00Z',
};

function renderActivity(activity: Activity): void {
  render(
    <MemoryRouter>
      <ActivityItem activity={activity} actorName="Alice" />
    </MemoryRouter>
  );
}

describe('ActivityItem — board_github_branch_updated', () => {
  it('renders an explicit default-branch label when the branch override is cleared (next === null)', () => {
    renderActivity({ ...baseActivity, payload: { next: null, previous: 'release/1.2' } });
    // getByText throws unless exactly matching — toBeFalsy() keeps the assertion
    // lint-free without adding toBeInTheDocument type-load to the baseline.
    expect(screen.getByText(/changed the GitHub branch scope to the repository's default branch/)).toBeTruthy();
  });

  it('renders an explicit default-branch label when next is absent entirely (legacy rows)', () => {
    renderActivity({ ...baseActivity, payload: {} });
    expect(screen.getByText(/changed the GitHub branch scope to the repository's default branch/)).toBeTruthy();
  });

  it('renders the new branch name when one is set (next non-null)', () => {
    renderActivity({ ...baseActivity, payload: { next: 'feature/x', previous: null } });
    expect(screen.getByText(/changed the GitHub branch scope to feature\/x/)).toBeTruthy();
  });

  it('never renders a dangling "scope to" with an empty label', () => {
    renderActivity({ ...baseActivity, payload: { next: null } });
    const el = screen.getByText(/GitHub branch scope/);
    expect(el.textContent).not.toMatch(/scope to\s*$/);
    expect(el.textContent).not.toMatch(/scope to $/);
  });

  it('leaves {next} interpolation untouched for other events using payload.next', () => {
    renderActivity({
      ...baseActivity,
      action: 'card.field.updated',
      payload: { next: null, fieldName: 'money' },
    });
    // Not the branch template — the generic fallback (unknown action) must not
    // receive the branch default label either.
    expect(screen.queryByText(/default branch/)).toBeNull();
  });
});

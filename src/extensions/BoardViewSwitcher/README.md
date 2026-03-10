# BoardViewSwitcher

Sprint 52 — View Persistence (E-VIEW-04)

## Overview

Tab bar that lets users switch between Kanban, Table, Calendar, and Timeline views on a board. The active view is persisted server-side per user per board via `GET/PUT /api/v1/boards/:id/view-preference`.

## Structure

```
BoardViewSwitcher/
  BoardViewSwitcher.tsx       # Root tab bar component
  BoardViewTab.tsx            # Single tab button
  viewPreference.slice.ts     # Redux slice (activeView, status)
  api.ts                      # GET/PUT view preference API calls
  hooks.ts                    # useViewPreference hook
  icons.tsx                   # SVG icons for each view type
  types.ts                    # ViewType, ViewPreference, ViewPreferenceState
  constants.ts                # VIEW_TYPES, DEFAULT_VIEW
  utils.ts                    # normaliseViewType helper
  translations/en.json        # i18n strings
  index.ts                    # Public re-exports
```

## Usage

Mount `<BoardViewSwitcher boardId={boardId} />` in the board toolbar. The component:

1. On mount: dispatches `fetchViewPreference` to load the user's last saved view.
2. On tab click: dispatches `setActiveView` (optimistic) then `saveViewPreference` (PUT).

Use `selectActiveView` from the slice to conditionally render the correct view component.

## Redux integration

The `viewPreference` reducer must be registered in `src/store/index.ts` (done).

## Tests

- `__tests__/viewPreference.slice.spec.ts` — unit tests for the Redux slice
- `__tests__/integration.playwright.ts` — Playwright E2E test (requires live server)

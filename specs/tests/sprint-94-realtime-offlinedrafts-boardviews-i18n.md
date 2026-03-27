> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 94 — Realtime + OfflineDrafts + BoardViews i18n — Playwright MCP Test Plan

## Overview

Verify that all UI copy in the Realtime, OfflineDrafts, and BoardViews extensions
renders from translation keys and no hardcoded English strings remain.

---

## Prerequisites

- Dev server running at `http://localhost:3000`
- At least one board with cards exists
- A logged-in admin/member session

---

## Test 1: Realtime Connection Status (ConnectionBadge)

### Steps

1. Navigate to `http://localhost:3000` and open a board.
2. Observe the top-right area of the board header.
3. Confirm the connection badge displays **"Live"** (green pill) when WebSocket is connected.
4. Throttle network in DevTools → set to "Offline" and wait ~5 s.
5. Confirm the badge transitions to **"Reconnecting…"** (yellow spinning indicator).
6. Re-enable network.
7. If WebSocket is unavailable and polling fallback activates, confirm the blue pill shows **"Polling"** with the correct tooltip text.

### Expected Values (from `Realtime/translations/en.json`)

| Key | Expected text |
|-----|---------------|
| `Realtime.statusLive` | `Live` |
| `Realtime.statusReconnecting` | `Reconnecting…` |
| `Realtime.statusOffline` | `Offline` |
| `Realtime.statusPolling` | `Polling` |
| `Realtime.statusPollingTitle` | `WebSocket unavailable — board events are being received via HTTP polling` |

---

## Test 2: Presence Avatars Aria Label

### Steps

1. Open a board with another active user present (or simulate via DevTools WS).
2. Inspect the presence avatar container in the DOM.
3. Confirm `aria-label` attribute equals **"Active board members"**.

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Realtime.ariaActiveBoardMembers` | `Active board members` |

---

## Test 3: OfflineDrafts — Translation File Exists

### Steps

1. Open `src/extensions/OfflineDrafts/translations/en.json` and confirm the following keys are present:

| Key | Expected text |
|-----|---------------|
| `OfflineDrafts.draftBanner` | `You have an unsaved draft` |
| `OfflineDrafts.restoreButton` | `Restore draft` |
| `OfflineDrafts.discardButton` | `Discard` |
| `OfflineDrafts.savedIndicator` | `Draft saved` |
| `OfflineDrafts.syncingIndicator` | `Syncing draft…` |
| `OfflineDrafts.ariaClose` | `Dismiss draft banner` |

2. Confirm no `.tsx` files in `src/extensions/OfflineDrafts/` contain hardcoded equivalents.

---

## Test 4: BoardViews — Comments Panel

### Steps

1. Navigate to a board and open the **Comments** panel (board sidebar or panel drawer).
2. Confirm the section heading reads **"Comments"**.
3. If no comments exist, confirm the empty state reads **"No comments yet."**
4. Confirm the **"Load more"** button is visible (when `hasMore=true`).

### Expected Values

| Key | Expected text |
|-----|---------------|
| `BoardViews.commentsHeading` | `Comments` |
| `BoardViews.noComments` | `No comments yet.` |
| `BoardViews.loadingComments` | `Loading…` |
| `BoardViews.loadMoreComments` | `Load more` |
| `BoardViews.errorLoadComments` | `Failed to load comments.` |

---

## Test 5: BoardViews — Archived Cards Panel

### Steps

1. Archive at least one card on a board.
2. Open the **Archived Cards** panel.
3. Confirm the section heading reads **"Archived Cards"**.
4. Confirm the loading indicator reads **"Loading…"** during initial fetch.
5. Confirm archived cards show **"in {list name}"** prefix.
6. Confirm the restore button reads **"Restore"** (idle) and **"Restoring…"** (in-progress).
7. If no archived cards exist, confirm the empty state reads **"No archived cards."**

### Expected Values

| Key | Expected text |
|-----|---------------|
| `BoardViews.archivedCardsHeading` | `Archived Cards` |
| `BoardViews.loadingArchivedCards` | `Loading…` |
| `BoardViews.noArchivedCards` | `No archived cards.` |
| `BoardViews.restoreButton` | `Restore` |
| `BoardViews.restoringButton` | `Restoring…` |
| `BoardViews.inList` | `in` |
| `BoardViews.errorLoadArchivedCards` | `Failed to load archived cards.` |
| `BoardViews.errorRestoreCard` | `Failed to restore card.` |

---

## Test 6: BoardViews — Activity Panel (Error Path)

### Steps

1. Open the Board Activity panel.
2. Simulate a network failure (DevTools → Offline) and reload the panel.
3. Confirm the error message reads **"Failed to load activity."**

### Expected Values

| Key | Expected text |
|-----|---------------|
| `BoardViews.errorLoadActivity` | `Failed to load activity.` |

---

## Grep Verification

Run the following command to confirm zero hardcoded strings remain in these extensions:

```bash
grep -rn \
  '"Live"\|"Reconnecting…"\|"Offline"\|"Polling"\|"Active board members"\|"Comments"\|"No comments yet"\|"Load more"\|"Archived Cards"\|"No archived cards"\|"Restoring…"\|"Restore"\|"Failed to load"' \
  src/extensions/Realtime src/extensions/OfflineDrafts src/extensions/BoardViews \
  src/common/components/ConnectionBadge.tsx \
  --include="*.tsx"
```

Expected output: **no matches**.
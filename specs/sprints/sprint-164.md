# Sprint 164 - Board Chat UI Entry + Sidebar History

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 18 (Board View), Sprint 79 (Board Member Management UI)
> **Status:** ⬜ Future

---

## Goal

Add a board-level chat entrypoint in the header and a right-side chat drawer with message history, with a strict baseline rule that guests cannot see or use chat in this sprint.

---

## Strict Boundary

1. This sprint covers UI shell and baseline visibility only.
2. AI actions, vector storage, and repository workflows are out of scope.
3. Guests are fully hidden from chat UI regardless of backend data.

---

## Scope

### 1. Board Header Chat Icon

Add a chat icon button in the board header, placed beside the plugin and board settings icons.

- Icon visible only for workspace members who are also board members.
- Icon hidden for all guest roles.
- Tooltip: "Board chat".

### 1.1 Sidebar Layout Spec (Reference UI)

The right drawer follows a compact mobile-first panel layout:

- Header row: `Board Chat` title, history button, options button, close button.
- Guest access status row directly under header (for example: `GUEST ACCESS (MEMBER ONLY)`).
- Permission action buttons row under status (guest policy controls introduced in Sprint 165).
- Date divider chips in timeline (for example: `TUESDAY, OCT 24`).
- Message feed using stacked message bubbles with avatar + sender + timestamp.
- Sticky composer footer with message input, send button, and AI-assist shortcut row.

### 2. Right Sidebar Chat Drawer

Clicking the chat icon opens a right-side drawer panel.

- Fixed right panel with overlay and escape-to-close support.
- Header shows board name and chat title.
- Message list shows history (initially from existing API placeholder/stub).
- Composer input and Send button are present (send can be no-op in this sprint if backend endpoint is not ready).
- Drawer remains fixed width on desktop and full width on small screens.
- Message list area scrolls independently while footer composer remains sticky.

### 3. History UI Foundation

- Chronological message feed with author, timestamp, and message text.
- Empty state: "No conversation yet".
- Loading and error states for history fetch.
- Support assistant/system message card style distinct from member message bubbles.

### 4. Client Feature Gate

- Add `BOARD_CHAT_ENABLED` flag support.
- When disabled, icon and drawer never render.

---

## Deliverables

1. Board header chat icon next to plugin/settings controls.
2. `BoardChatDrawer` component with open/close and history rendering.
3. Chat history query wiring (can use stub contract if backend endpoint lands in next sprint).
4. Guest-hidden UI guard.
5. Unit tests for icon visibility and drawer open/close behaviour.
6. Sidebar structural layout parity with reference UI sections (header, guest status area, timeline, sticky composer).

---

## Acceptance Criteria

1. Workspace member can see the chat icon in board header near plugin/settings icons.
2. Guest cannot see the chat icon anywhere on board page.
3. Clicking icon opens a right sidebar drawer; pressing Escape closes it.
4. Drawer shows conversation history list with loading/empty/error states.
5. `BOARD_CHAT_ENABLED=false` hides the chat UI for all users.
6. Sidebar includes fixed header and sticky composer footer with independent scrolling message history.

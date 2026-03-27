> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Playwright MCP Test Spec — Board Activity Notification Panel (Sprint 73)

> Tests the client-side notification panel for the 3 new board activity types:
> `card_created`, `card_moved`, `card_commented` — and their icons and copy.

---

## Setup

- Feature flags: `NOTIFICATION_PREFERENCES_ENABLED=true`, `EMAIL_NOTIFICATIONS_ENABLED=false`
- Two seeded users: **User A** (actor) and **User B** (recipient), both workspace members.
- One seeded board with two lists: "To Do" and "In Progress".
- One seeded card: **"Fix login bug"** in list "To Do".

---

## Scenario 1 — card_created notification shows correct icon and copy

**Given** User A is logged in  
**When** User A creates a new card titled **"Add dark mode"** on the board  
**Then** a `card.created` event is fired  
**And** User B receives a `notification_created` WS event with `type: "card_created"`

**Given** User B opens the notification bell  
**Then** the panel shows one notification item  
**And** the item shows a `RectangleStackIcon` (green/emerald colour class)  
**And** the item text reads: **"User A created "Add dark mode" in [BoardName]"**  
**And** the item has an unread indicator dot  
**And** clicking the item navigates to `/boards/{boardId}/cards/{cardId}` and marks it read

---

## Scenario 2 — card_moved notification shows correct icon and copy

**Given** User A is logged in  
**When** User A drags card **"Fix login bug"** from "To Do" to "In Progress"  
**Then** a `card.moved` event is fired  
**And** User B receives a `notification_created` WS event with `type: "card_moved"` and `list_title: "In Progress"`

**Given** User B opens the notification bell  
**Then** a notification item appears at the top of the list  
**And** the item shows an `ArrowRightIcon` (sky/blue colour class)  
**And** the item text reads: **"User A moved "Fix login bug" to In Progress"**  
**And** no board name subtitle is shown in addition to the copy (board_title appears as secondary line)

---

## Scenario 3 — card_commented notification shows correct icon and copy

**Given** User A is logged in  
**When** User A posts a comment on card **"Fix login bug"**  
**Then** a `comment.created` event is fired  
**And** User B receives a `notification_created` WS event with `type: "card_commented"`

**Given** User B opens the notification bell  
**Then** a notification item appears at the top of the list  
**And** the item shows a `ChatBubbleLeftEllipsisIcon` (amber/yellow colour class)  
**And** the item text reads: **"User A commented on "Fix login bug""**

---

## Scenario 4 — mention notification icon is unchanged

**Given** User A posts a comment mentioning **@UserB** on card **"Fix login bug"**  
**Then** User B receives a `mention` type notification

**Given** User B opens the notification bell  
**Then** the item shows an `AtSymbolIcon` (indigo colour class)  
**And** the item text reads: **"User A mentioned you in "Fix login bug""**

---

## Scenario 5 — multiple notification types appear in order

**Given** all three board activity events (card_created, card_moved, card_commented) were fired in sequence  
**When** User B opens the notification bell  
**Then** all three notifications are listed, newest first  
**And** each shows its distinct icon and copy  
**And** the unread count badge on the bell shows **3**

---

## Scenario 6 — marking one notification read removes its unread indicator

**Given** User B sees three unread notifications  
**When** User B clicks the `card_moved` notification  
**Then** the unread dot disappears from that item  
**And** the unread count badge decreases by 1  
**And** the user is navigated to the card detail

---

## Scenario 7 — member with in_app_enabled:false does not receive notification

**Given** User B has `in_app_enabled: false` for `card_moved` (patched via PATCH /api/v1/notifications/preferences)  
**When** User A moves a card  
**Then** User B does NOT receive a `notification_created` WS event for that move  
**And** User B's notification panel does NOT show a card_moved entry

---

## Scenario 8 — WS real-time append without page reload

**Given** User B has the notification panel open  
**When** User A creates a new card (triggering a `card.created` event in real time)  
**Then** a new notification item appears at the top of the panel WITHOUT a page reload  
**And** the item shows `RectangleStackIcon` and the correct copy  
**And** the bell badge count increments by 1

---

## Scenario 9 — API type filter returns correct results

**Given** at least one notification of each type exists for User B  
**When** a GET request is made to `/api/v1/notifications?type=card_created`  
**Then** the response `data` array contains ONLY notifications with `type: "card_created"`  
**And** notifications of other types are excluded

---

## Scenario 10 — notification panel fallback copy when list_title is absent (card_moved edge case)

**Given** a `card_moved` notification was created but the destination list has since been deleted  
**When** User B opens the notification panel  
**Then** the item text reads: **"User A moved "Fix login bug""** (graceful fallback without "to [listName]")  
**And** no error is thrown in the UI
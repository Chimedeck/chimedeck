> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# E2E Test: Notifications for @Mentions

## Test ID
`notifications-mention`

## Goal
Verify that when User A mentions User B in a comment, User B sees a real-time notification badge and can navigate to the referenced card via the notification panel.

## Prerequisites
- Two registered users: `userA` (actor) and `userB` (recipient), both members of the same board
- `userB` has a nickname set
- A card exists on the board

## Steps

### 1. Login as User B, open the app
- Navigate to `/` and log in as `userB`
- Verify the notification bell badge is **not visible** (no unread notifications)

### 2. In a second tab/session, login as User A and add a comment
- Navigate to the same board as User A
- Open the card detail modal
- Add a comment: `Hey @<userB_nickname>, check this out!`
- Submit the comment

### 3. Verify real-time notification delivery (User B session)
- Within ~2 seconds, User B's notification bell should show a red badge with count `1`
- No page reload required

### 4. Open the notification panel
- User B clicks the 🔔 bell
- The notification panel opens
- The panel shows one unread item: `<userA_nickname> mentioned you in "<card_title>"`
- The board name is displayed beneath the card title
- The unread indicator dot is visible (indigo)

### 5. Click the notification
- User B clicks the notification row
- The panel closes
- Navigation occurs to `/boards/:boardId?card=:cardId`
- The card modal opens showing the comment

### 6. Verify badge cleared
- After clicking the notification, the bell badge disappears (count 0)

## Acceptance Criteria
- [ ] Badge appears within ~2 s of mention creation (no reload)
- [ ] Panel shows actor nickname, card title, and board name
- [ ] Clicking navigates to the correct board + card
- [ ] Badge disappears after reading
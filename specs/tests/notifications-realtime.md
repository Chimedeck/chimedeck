# E2E Test: Real-time Notification Badge (Two-Tab)

## Test ID
`notifications-realtime`

## Goal
Verify that a notification badge appears in real-time (without page reload) when another user mentions you.

## Prerequisites
- Playwright test with two browser contexts (simulating two users)
- Both users are members of the same workspace and board

## Steps

### Tab 1 (User B — recipient)
1. Log in as `userB`
2. Navigate to the board page
3. Assert: notification bell badge is **absent** (no `aria-label` containing "unread")

### Tab 2 (User A — actor)
4. Log in as `userA`
5. Navigate to the same board
6. Open the card modal for a shared card
7. Type and submit a comment: `@<userB_nickname> this is for you`

### Tab 1 (User B — recipient) — real-time check
8. Wait up to 3 seconds (no reload)
9. Assert: notification bell badge is now **visible** with count `1`

## Playwright Pseudo-Code
```ts
// context1 = userB session
// context2 = userA session

await page1.goto('/boards/BOARD_ID');
await expect(page1.getByRole('button', { name: /Notifications/ })).not.toHaveText(/1/);

// userA posts mention in context2
await page2.goto('/boards/BOARD_ID');
await page2.click('[data-card-id="CARD_ID"]');
await page2.fill('[data-testid="comment-input"]', '@userB_nickname hello');
await page2.click('[data-testid="comment-submit"]');

// Assert badge on userB page without reload
await expect(page1.getByRole('button', { name: /1 unread/ })).toBeVisible({ timeout: 3000 });
```

## Acceptance Criteria
- [ ] Badge appears within 3 s of mention (WebSocket delivery)
- [ ] No page reload required
- [ ] Badge count is accurate (1 new mention → badge shows 1)

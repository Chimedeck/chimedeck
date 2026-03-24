# Sprint 90 · Iteration 2 — Activity Extension i18n

## Purpose
Verify that the Activity extension reads all its UI copy from
`src/extensions/Activity/translations/en.json` and that no hard-coded English
strings remain in the Activity components. All visible text (section title,
empty state, loading indicator, load-more button, and action descriptions) must
match the JSON values exactly.

## Preconditions
- Dev server is running and reachable.
- At least one board with at least one card exists in the workspace.
- The signed-in user has permission to view and interact with the card.

---

## Test 1 — Activity section renders correctly (empty state)

### Steps
1. Log in and navigate to a board.
2. Open a card that has **no activity events yet** (a brand-new card).
3. Scroll to or locate the Activity section in the card modal.

### Expected
- Section heading reads **"Activity"** (from `translations['activity.section.title']`).
- Empty-state paragraph reads **"No activity yet."** (from `translations['activity.empty']`).
- No raw translation key (e.g. `activity.empty`) is visible anywhere.

---

## Test 2 — Activity items render after an action

### Steps
1. On the same card, perform an action that generates an activity event
   (e.g. change the card title or move it to another list).
2. Re-open the card modal (or wait for the feed to refresh).
3. Observe the Activity feed.

### Expected
- At least one activity item appears, showing a human-readable description
  (e.g. **"&lt;actor&gt; updated card "&lt;title&gt;""**).
- The description matches the template from the JSON file
  (e.g. `translations['activity.action.card_updated']` with placeholders filled).
- A relative or absolute timestamp is displayed next to each item.

---

## Test 3 — Loading indicator

### Steps
1. Open a card modal that triggers a network request to load activity.
2. Observe the Activity section while the request is in-flight (simulate slow
   network if necessary by throttling in DevTools).

### Expected
- While loading, the text **"Loading…"** is visible
  (from `translations['activity.loading']`).
- Once loading completes, the loading text disappears and items (or the empty
  state) are shown.

---

## Test 4 — Load more button

### Steps
1. Open a card that has **more than one page** of activity events.
2. Scroll to the bottom of the Activity feed.
3. Observe the button below the last item.

### Expected
- A button labelled **"Load more"** is visible
  (from `translations['activity.loadMore']`).
- Clicking **Load more** fetches and appends additional activity items.
- The button disappears once all events have been loaded (`hasMore = false`).

---

## Test 5 — Action description templates use JSON values

### Steps
1. Perform each of the following actions on a card and verify the resulting
   activity description in the feed:
   - Create a new card.
   - Move the card to a different list.
   - Archive the card.
   - Add a comment to the card.
   - Assign a member to the card.

### Expected
- **Card created**: description matches `translations['activity.action.card_created']`
  with `{actor}` and `{title}` interpolated correctly.
- **Card moved**: description matches `translations['activity.action.card_moved']`
  with `{actor}`, `{title}`, `{fromList}`, and `{toList}` interpolated.
- **Card archived**: matches `translations['activity.action.card_archived']`.
- **Comment added**: matches `translations['activity.action.comment_added']`
  with `{actor}` and `{cardTitle}` interpolated.
- **Member assigned**: matches `translations['activity.action.member_assigned']`.
- No description contains a raw `{placeholder}` token.

---

## Test 6 — No regressions

### Steps
1. Complete Tests 1–5 in sequence.

### Expected
- All Activity feed behaviours (empty state, item display, loading, pagination)
  work identically to pre-i18n behaviour.
- No JavaScript errors appear in the browser console.
- No visible text is a raw translation key (e.g. `activity.section.title`).

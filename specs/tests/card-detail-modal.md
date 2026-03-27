> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Card Detail Modal

## Overview
Verifies that clicking a card opens the detail modal with the two-column layout, title can be edited inline, and the modal can be closed.

## Prerequisites
- User is logged in
- A board exists with at least one list containing a card

## Steps

### 1. Open card modal
1. Navigate to `/boards/:boardId`
2. Wait for the kanban board to load
3. Locate a card chip in any list column
4. Click the card chip

### Expected Result
- The card detail modal opens without a full page navigation
- The URL updates to include `?card=:cardId`
- The modal shows the card title, list name, and board name
- The modal uses a **two-column layout**: left column contains the card content (description, checklist, etc.), right column contains the ActivityFeed
- A **CardMetaStrip** (labels, members, dates) is visible directly below the title/breadcrumb
- A sticky **bottom action bar** is visible at the bottom of the modal (Power-ups, Automations, Actions, Activity buttons)
- There is **no sidebar** for Labels, Members, or Dates
- The header contains only the **close (✕) button** — there is no ··· (three-dot) button

### 2. Edit card title inline
1. Click the card title in the modal header
2. Clear the existing title and type a new title (e.g. "Updated title from test")
3. Press Enter or click outside the input

### Expected Result
- The title input saves on blur/Enter
- The updated title is reflected in the modal header
- The updated title is reflected in the board card chip (optimistic update)

### 3. Close modal via Escape key
1. While the modal is open, press the Escape key

### Expected Result
- The modal closes
- The URL reverts to the board URL without `?card=` param
- The board view is visible again

### 4. Close modal via backdrop click
1. Open a card modal
2. Click the dark backdrop area outside the modal panel

### Expected Result
- The modal closes
- The URL is cleared of the `?card=` param

### 5. Deep link to card
1. Copy the URL while a card modal is open (includes `?card=:cardId`)
2. Open the copied URL in a new tab

### Expected Result
- The board loads with the card modal open immediately
- The correct card data is displayed

### 6. Verify two-column layout and ResizablePanels
1. Open a card modal on a desktop viewport (≥ 768px)

### Expected Result
- Two columns are visible side by side with a drag handle between them
- The left column contains description, checklist, attachments, custom fields
- The right column contains the ActivityFeed
- Dragging the handle resizes the columns

### 7. Verify mobile single-column layout
1. Open a card modal on a mobile viewport (< 768px)

### Expected Result
- The columns stack vertically (no drag handle visible)
- Content appears in a single scrollable column

### 8. Verify value/plugin badge row in left column
1. Open a card that has an amount/currency set
2. Scroll down past checklist and attachments in the left column

### Expected Result
- A horizontal badge row is visible in the left column (below checklist and attachments)
- The CardValue money badge (amount + currency inputs) is present in this row
- The CardDetailPluginBadges region is present in the same row
- There is **no** "Value" sidebar section anywhere in the modal
- All badge content is inside the left content column, not a separate sidebar

### 9. Verify no sidebar sections remain
1. Open any card modal
2. Inspect the full modal structure

### Expected Result
- No sidebar panel exists for Members, Labels, Dates, or Value
- All metadata (labels, members, dates) appears only in CardMetaStrip below the title/breadcrumb
- The modal body is either a two-column ResizablePanels layout (activity visible) or a single content column (activity hidden)
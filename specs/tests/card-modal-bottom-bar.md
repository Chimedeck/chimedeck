# Test: CardModalBottomBar — Activity Toggle & Actions Dropdown

## Overview
Verifies the sticky bottom action bar in the card detail modal: presence of the bar, activity panel toggle, and Actions dropdown options.

## Prerequisites
- User is logged in
- A board exists with at least one list containing at least one card

---

## Steps

### 1. Open card modal

1. Navigate to `/boards/:boardId`
2. Wait for the kanban board to load
3. Click a card chip to open the card detail modal

#### Expected Result
- Card detail modal opens
- A sticky bottom bar is visible at the bottom of the modal
- The bar contains at least: **Power-ups**, **Automations**, **Actions**, and **Activity** buttons

---

### 2. Verify activity panel is visible by default

1. With the card modal open, inspect the modal body

#### Expected Result
- The activity panel / `ActivityFeed` section is rendered and visible
- The **Activity** toggle button reflects the active state (pressed/highlighted)

---

### 3. Toggle activity panel off

1. Click the **Activity** button in the bottom bar

#### Expected Result
- The activity panel is hidden (removed from DOM / not visible)
- The **Activity** toggle button is no longer in the active/pressed state

---

### 4. Toggle activity panel back on

1. Click the **Activity** button again

#### Expected Result
- The activity panel reappears
- The **Activity** toggle button returns to the active/pressed state

---

### 5. Open Actions dropdown

1. Click the **Actions** button in the bottom bar

#### Expected Result
- A dropdown/popover appears above the Actions button
- The dropdown contains:
  - **Archive card** (or **Unarchive card** if already archived)
  - **Copy link**
  - **Delete card** (styled in red)

---

### 6. Close Actions dropdown with Escape

1. With the Actions dropdown open, press `Escape`

#### Expected Result
- The Actions dropdown closes
- No card action was triggered

---

### 7. Copy link from Actions dropdown

1. Open the **Actions** dropdown
2. Click **Copy link**

#### Expected Result
- The dropdown closes
- The card link is copied to the clipboard (or the copy link handler is called without errors)

---

### 8. Actions dropdown closes on outside click

1. Open the **Actions** dropdown
2. Click anywhere outside the dropdown (but still inside the modal)

#### Expected Result
- The dropdown closes without triggering any action

# Test: Card Detail Modal

## Overview
Verifies that clicking a card opens the detail modal, title can be edited inline, and the modal can be closed.

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
- The description section is visible
- The sidebar shows Labels, Members, Due Date, and Actions sections

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

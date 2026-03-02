# Test: Card Checklist

## Overview
Verifies checklist item creation, completion toggling with optimistic UI, and progress bar updates.

## Prerequisites
- User is logged in
- A board exists with at least one list containing a card
- The card detail modal is open

## Steps

### 1. Add a checklist item
1. Open a card modal
2. Click "+ Add item" in the Checklist section
3. Type "Write unit tests" in the input
4. Press Enter

### Expected Result
- The item "Write unit tests" appears in the checklist immediately (optimistic)
- The progress bar shows `0/1` (0%)
- The `POST /api/v1/cards/:id/checklist` request is made in the background

### 2. Check a checklist item (optimistic toggle)
1. Click the checkbox next to "Write unit tests"

### Expected Result
- The checkbox is checked immediately without waiting for the server
- The item title gets a strikethrough style
- The progress bar updates to `1/1` (100%) in emerald green
- The `PATCH /api/v1/checklist-items/:itemId` request is fired in the background

### 3. Uncheck a checklist item
1. Click the checked checkbox to uncheck it

### Expected Result
- The checkbox unchecks immediately
- The strikethrough is removed
- The progress bar updates back to `0/1` (0%)

### 4. Delete a checklist item
1. Hover over a checklist item to reveal the delete button
2. Click the delete (✕) button

### Expected Result
- The item is removed from the list immediately (optimistic)
- The progress bar updates accordingly
- The `DELETE /api/v1/checklist-items/:itemId` request is fired

### 5. Rollback on API error
1. Simulate a network error on the toggle API call
2. Attempt to check a checklist item

### Expected Result
- The item optimistically checks
- After the API error, the item reverts to its original state
- An error indicator or toast may be shown (implementation detail)

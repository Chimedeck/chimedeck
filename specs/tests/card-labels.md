# Test: Card Labels

## Overview
Verifies that labels can be created, assigned to a card, and removed, with immediate optimistic UI updates.

## Prerequisites
- User is logged in
- A board exists with at least one list and one card
- The card detail modal is open

## Steps

### 1. Open the label picker
1. Click "+ Add label" in the Labels sidebar section

### Expected Result
- A popover appears with a name input, a grid of 8 preset colours, and any existing board labels
- The input is auto-focused

### 2. Create a new label
1. Type "Feature" in the name input
2. Select the indigo colour from the colour grid
3. Click the "Create 'Feature'" button or press Enter

### Expected Result
- The label "Feature" (indigo) is created via `POST /api/v1/boards/:boardId/labels`
- The new label is immediately assigned to the card (shown in the Labels section as a chip)
- The label chip appears with the correct colour and name

### 3. Assign an existing label
1. Open the label picker again
2. Click on an existing label from the "Existing labels" section

### Expected Result
- The label chip appears immediately in the Labels section (optimistic)
- The `POST /api/v1/cards/:id/labels` request is sent in the background

### 4. Remove a label from a card
1. Click the × button on an assigned label chip in the Labels section

### Expected Result
- The label chip disappears immediately from the sidebar (optimistic)
- The `DELETE /api/v1/cards/:id/labels/:labelId` request is sent in the background

### 5. Rollback on error
1. Simulate a network error on the label assign API
2. Attempt to assign a label

### Expected Result
- The label appears optimistically
- After the error, the label chip is removed (rollback to previous state)

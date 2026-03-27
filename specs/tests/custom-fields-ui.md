> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Custom Fields UI — Card Modal Value Editing & Tile Badge Tests

## Prerequisites
- The dev server is running at http://localhost:5173
- A workspace and board exist
- The board has no custom fields yet

---

## Test 1: TEXT field — edit value in card modal

### Setup
- navigate to the board page
- ensure at least one card exists in any list

### Steps
1. Open board settings (click the settings gear icon in the board header)
2. Click "Custom Fields" in the board settings sidebar
3. Click "Add field"
4. Enter name "Notes"
5. Select field type "TEXT"
6. Ensure "Show on card" toggle is ON
7. Click "Save" or press Enter to confirm
8. Close board settings
9. Click on any card tile to open the card detail modal
10. Scroll down in the main column past the description section
11. Verify a "Custom Fields" section is visible with a "Notes" label
12. Click the text input next to "Notes"
13. Type "Hello world"
14. Press Tab or click outside the input to save
15. Close the card modal

### Expected Results
- The "Custom Fields" section appears in the card modal below the description
- The text value "Hello world" is saved
- After closing, the card tile shows a badge with value "Hello world" (because show_on_card is true)

---

## Test 2: NUMBER field — edit value in card modal

### Setup
- A NUMBER custom field named "Story Points" exists on the board (created via board settings)
- "Show on card" is ON for this field

### Steps
1. Open any card modal
2. In the "Custom Fields" section, locate "Story Points"
3. Click the number input
4. Type "8"
5. Press Enter to save
6. Close the card modal

### Expected Results
- The "Story Points" value "8" is saved
- The card tile shows a badge displaying "8"

---

## Test 3: DATE field — edit value in card modal

### Setup
- A DATE custom field named "Target Date" exists with show_on_card=true

### Steps
1. Open any card modal
2. Locate the "Target Date" field in "Custom Fields"
3. Click the date picker input
4. Select a date (e.g., 2025-12-31)
5. Close the card modal

### Expected Results
- The date value is saved
- The card tile shows a badge with the formatted date (e.g., "12/31/2025")

---

## Test 4: CHECKBOX field — toggle value in card modal

### Setup
- A CHECKBOX custom field named "Reviewed" exists with show_on_card=true

### Steps
1. Open any card modal
2. Locate the "Reviewed" field in "Custom Fields"
3. Verify the checkbox shows "No" (unchecked state)
4. Click the checkbox to toggle it to checked
5. Verify label changes to "Yes"
6. Close the card modal

### Expected Results
- The checkbox value is saved as true
- The card tile shows a badge with "✓" (checked state, green style)

---

## Test 5: DROPDOWN field — select option in card modal

### Setup
- A DROPDOWN custom field named "Priority" exists with options: "High" (#EF4444), "Medium" (#EAB308), "Low" (#22C55E)
- "Show on card" is ON

### Steps
1. Open any card modal
2. Locate the "Priority" field in "Custom Fields"
3. Click the dropdown select
4. Choose "High"
5. Verify the colour swatch changes to red (#EF4444)
6. Close the card modal

### Expected Results
- "High" is saved as the selected option
- The card tile shows a badge with a red dot and label "High"

---

## Test 6: Clear a field value

### Setup
- A TEXT field "Notes" has value "Hello world" set from Test 1

### Steps
1. Open the same card modal from Test 1
2. Locate the "Notes" field
3. Click the "✕" (clear) button next to the text input
4. Close the card modal

### Expected Results
- The "Notes" value is cleared (input is empty)
- The card tile no longer shows the "Hello world" badge (badge disappears when value is null)

---

## Test 7: show_on_card=false — no badge on tile

### Setup
- A TEXT custom field "Internal Notes" exists with show_on_card=OFF

### Steps
1. Open any card modal
2. In "Custom Fields", type a value for "Internal Notes" (e.g., "private text")
3. Save and close modal

### Expected Results
- The card tile does NOT show any badge for "Internal Notes"
- The value is still visible inside the card modal

---

## Test 8: Verify badges for multiple fields on tile

### Setup
- Two fields both have show_on_card=true and values set: "Notes" = "Hello" and "Story Points" = "5"

### Steps
1. Verify the card tile shows two badges side by side
2. Hover over the badges to see the tooltip (fieldName: value)

### Expected Results
- Two badges are visible on the card tile
- Each badge shows the correct value
- Tooltips show "Notes: Hello" and "Story Points: 5"
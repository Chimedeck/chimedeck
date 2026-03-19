# Test: Sprint 93 — CustomFields i18n

**Sprint:** 93  
**Tool:** Playwright MCP

## Setup
- Log in as an admin user
- Open or create a board
- Navigate to Board Settings → Custom Fields panel

## Steps

### 1. Panel title and empty state
1. Open Board Settings for a board that has no custom fields
2. Verify the section heading reads `"Custom Fields"` (from `CustomFields.panelTitle`)
3. Verify the empty-state message reads `"No custom fields yet"` (from `CustomFields.noFields`)
4. Verify the add button reads `"+ Add custom field"` (from `CustomFields.addFieldButton`)
5. Verify the add button `aria-label` is `"Create custom field"` (from `CustomFields.ariaCreateField`)

### 2. Create field form
1. Click `"+ Add custom field"` to open the new-field form
2. Verify the form container `aria-label` is `"New custom field form"` (from `CustomFields.newFieldFormLabel`)
3. Verify the name input `placeholder` is `"Field name"` (from `CustomFields.fieldNamePlaceholder`)
4. Verify the type `<select>` `aria-label` is `"Field type"` (from `CustomFields.typeLabel`)
5. Verify the type `<select>` options contain: `"Text"`, `"Number"`, `"Checkbox"`, `"Date"`, `"Dropdown"` (from `CustomFields.type*`)
6. Verify the show-on-card checkbox label reads `"Show on card tile"` (from `CustomFields.showOnCardLabel`)
7. Verify the submit button reads `"Create field"` (from `CustomFields.createFieldButton`)
8. Verify the cancel button reads `"Cancel"` (from `CustomFields.cancelButton`)

### 3. Create a Text field
1. Enter a field name, select type `"Text"`, click `"Create field"`
2. Verify the field appears in the list with the correct type label `"Text"`
3. Open a card on the board; verify the Custom Fields section heading reads `"Custom Fields"` (from `CustomFields.panelTitle`)
4. Verify the text input `placeholder` is `"Enter text…"` (from `CustomFieldValue.textPlaceholder`)
5. Enter a value; verify the clear button `aria-label` contains `"Clear"` (from `CustomFieldValue.clearButton`)

### 4. Create a Number field
1. Create a field of type `"Number"`
2. Open a card; verify the number input `placeholder` is `"0"` (from `CustomFieldValue.numberPlaceholder`)

### 5. Create a Date field
1. Create a field of type `"Date"`
2. Open a card; set a date value; verify the `"Clear"` link text (from `CustomFieldValue.clearDate`) appears below the date picker

### 6. Create a Checkbox field
1. Create a field of type `"Checkbox"`
2. Open a card; verify unchecked state shows `"No"` and checked state shows `"Yes"` (from `CustomFieldValue.checkboxYes` / `CustomFieldValue.checkboxNo`)

### 7. Create a Dropdown field
1. Create a field of type `"Dropdown"`
2. Verify `"▼ Edit options"` button text (from `CustomFields.editOptions`) is shown on the field row
3. Click it; verify it toggles to `"▲ Hide options"` (from `CustomFields.hideOptions`)
4. Verify the dropdown options editor `aria-label` is `"Dropdown options editor"` (from `CustomFields.dropdownEditorLabel`)
5. Verify empty-options message reads `"No options yet. Add one below."` (from `CustomFields.dropdownNoOptions`)
6. Verify the add-option button reads `"+ Add option"` (from `CustomFields.dropdownAddOption`)
7. Verify the option label input `placeholder` is `"Option label"` (from `CustomFields.dropdownOptionPlaceholder`)
8. Open a card; verify the dropdown `<select>` first option reads `"— none —"` (from `CustomFieldValue.dropdownNone`)

### 8. Rename field
1. Click a field name to enter rename mode
2. Verify the rename input `aria-label` is `"Rename field"` (from `CustomFields.renameFieldAriaLabel`)

### 9. Loading state
1. Reload the board settings page and observe the brief loading state
2. Verify the loading indicator reads `"Loading…"` (from `CustomFields.loading`)

### 10. No hardcoded strings
1. Using browser DevTools, search the Custom Fields panel DOM for literal occurrences of:
   - `"Custom Fields"` as a text node — should only appear via translated value
   - `"Create field"`, `"Cancel"`, `"Field name"`, `"Field type"` — all sourced from translations
2. Grep `src/extensions/CustomFields/` for bare English strings not wrapped in `translations[...]`:
   ```
   grep -rn '"[A-Z][a-z]' src/extensions/CustomFields/ --include="*.tsx" | grep -v "translations\["
   ```
   Result should be empty (or only template-literal dynamic strings using translation values).

## Acceptance Criteria
- [ ] `CustomFields.panelTitle` renders as section heading and panel aria-label
- [ ] `CustomFields.noFields` renders in empty state
- [ ] `CustomFields.addFieldButton` and `CustomFields.ariaCreateField` render correctly
- [ ] New-field form labels, placeholders, and button text all sourced from translations
- [ ] All five type labels (`Text`, `Number`, `Checkbox`, `Date`, `Dropdown`) sourced from translations
- [ ] `CustomFields.showOnCardLabel` renders on both new-field form and existing fields
- [ ] `CustomFields.editOptions` / `CustomFields.hideOptions` toggle correctly
- [ ] All `CustomFieldValue.*` keys render in card value editors
- [ ] No hardcoded English strings remain in any `.tsx` file under `src/extensions/CustomFields/`

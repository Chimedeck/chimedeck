# Sprint 93 — i18n Phase 4: CustomFields, CalendarView, TimelineView & TableView

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 90 (i18n Phase 1), Sprint 52–55 (Views + Custom Fields)
> **References:** Existing pattern in `src/extensions/Card/translations/en.json`

---

## Goal

Extract all hard-coded English strings from four view/data extensions into per-feature `translations/en.json` files:

- **CustomFields** — field definition panel and card value editor
- **CalendarView** — monthly calendar grid and navigation
- **TimelineView** — Gantt bar controls and zoom UI
- **TableView** — table headers, empty states, and action labels

These four extensions share a similar surface area (dense data UI with labels, aria-labels, and action buttons) and can be tackled in a single sprint.

---

## Scope

### 1. CustomFields Extension

**New file:** `src/extensions/CustomFields/translations/en.json`

```json
{
  "CustomFields.panelTitle": "Custom Fields",
  "CustomFields.createButton": "Create custom field",
  "CustomFields.ariaOpenPanel": "Custom Fields",
  "CustomFields.ariaCreateField": "Create custom field",
  "CustomFields.fieldNamePlaceholder": "Field name",
  "CustomFields.typeLabel": "Field type",
  "CustomFields.typeText": "Text",
  "CustomFields.typeNumber": "Number",
  "CustomFields.typeCheckbox": "Checkbox",
  "CustomFields.typeDate": "Date",
  "CustomFields.typeDropdown": "Dropdown",
  "CustomFields.saveButton": "Save",
  "CustomFields.cancelButton": "Cancel",
  "CustomFields.deleteButton": "Delete Field",
  "CustomFields.deleteConfirm": "Delete this custom field? All card values will be lost.",
  "CustomFields.noFields": "No custom fields yet",

  "CustomFieldValue.textPlaceholder": "Enter text…",
  "CustomFieldValue.numberPlaceholder": "0",
  "CustomFieldValue.datePlaceholder": "Pick a date",
  "CustomFieldValue.dropdownPlaceholder": "Select…",
  "CustomFieldValue.clearButton": "Clear value"
}
```

Update all files in `src/extensions/CustomFields/`.

---

### 2. CalendarView Extension

**New file:** `src/extensions/CalendarView/translations/en.json`

```json
{
  "CalendarView.ariaMode": "Calendar mode",
  "CalendarView.todayButton": "Today",
  "CalendarView.monthView": "Month",
  "CalendarView.weekView": "Week",
  "CalendarView.ariaPrevMonth": "Previous month",
  "CalendarView.ariaNextMonth": "Next month",
  "CalendarView.ariaPrevWeek": "Previous week",
  "CalendarView.ariaNextWeek": "Next week",
  "CalendarView.noCards": "No cards due this month",
  "CalendarView.unscheduled": "Unscheduled",
  "CalendarView.allDayLabel": "All day"
}
```

Update all files in `src/extensions/CalendarView/`.

---

### 3. TimelineView Extension

**New file:** `src/extensions/TimelineView/translations/en.json`

```json
{
  "TimelineView.title": "Timeline",
  "TimelineView.noCards": "No cards with date ranges",
  "TimelineView.unscheduledLabel": "Unscheduled",
  "TimelineView.zoomLabel": "Timeline zoom level",
  "TimelineView.zoomDay": "Day",
  "TimelineView.zoomWeek": "Week",
  "TimelineView.zoomMonth": "Month",
  "TimelineView.zoomQuarter": "Quarter",
  "TimelineView.ariaResizeStart": "Resize start date",
  "TimelineView.ariaResizeDue": "Resize due date",
  "TimelineView.todayMarkerLabel": "Today",
  "TimelineView.addDateRange": "Add date range"
}
```

Update all files in `src/extensions/TimelineView/`.

---

### 4. TableView Extension

**New file:** `src/extensions/TableView/translations/en.json`

```json
{
  "TableView.title": "Table",
  "TableView.noCards": "No cards in this board",
  "TableView.columnTitle": "Title",
  "TableView.columnList": "List",
  "TableView.columnLabels": "Labels",
  "TableView.columnMembers": "Members",
  "TableView.columnDueDate": "Due Date",
  "TableView.columnStartDate": "Start Date",
  "TableView.columnMoney": "Value",
  "TableView.ariaSort": "Sort by",
  "TableView.ariaSortAsc": "Sort ascending",
  "TableView.ariaSortDesc": "Sort descending",
  "TableView.filterPlaceholder": "Filter cards…",
  "TableView.exportCsvButton": "Export CSV"
}
```

Update all files in `src/extensions/TableView/`.

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/CustomFields/translations/en.json` | **Create** |
| `src/extensions/CalendarView/translations/en.json` | **Create** |
| `src/extensions/TimelineView/translations/en.json` | **Create** |
| `src/extensions/TableView/translations/en.json` | **Create** |
| `src/extensions/CustomFields/**/*.tsx` | Update — replace inline strings |
| `src/extensions/CalendarView/**/*.tsx` | Update — replace inline strings |
| `src/extensions/TimelineView/**/*.tsx` | Update — replace inline strings |
| `src/extensions/TableView/**/*.tsx` | Update — replace inline strings |

---

## Acceptance Criteria

- [ ] All four `translations/en.json` files exist with complete coverage of their feature's user-visible strings
- [ ] No hardcoded English strings remain in any of the four extension folders
- [ ] `aria-label` attributes for navigation controls (calendar prev/next, timeline resize handles, zoom selector) sourced from JSON
- [ ] Components use `translations['Key']` bracket notation
- [ ] No new i18n library introduced
- [ ] CalendarView, TimelineView, TableView, and CustomFields UI all function identically after the refactor

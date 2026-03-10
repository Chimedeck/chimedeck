# TableView

Sprint 52 — Flat spreadsheet-style view of all cards on a board.

## Structure

```
src/extensions/TableView/
  TableView.tsx      # Root component — renders the <table> with header + rows
  TableHeader.tsx    # Sortable column <thead>; cycles asc → desc → none per column
  TableRow.tsx       # Single <tr> per card with all column cells
  useTableSort.ts    # Hook: builds TableRowData[], manages SortState, sorts on demand
  types.ts           # ColumnKey, SortState, TableRowData, TableColumn, TableViewProps
  README.md          # This file
```

## Usage

`TableView` is mounted in `BoardPage` when `activeView === 'TABLE'`:

```tsx
<TableView
  cards={Object.values(cards)}   // Card[] from boardSlice
  lists={lists}                  // Record<string, List> from boardSlice
  onCardClick={handleCardClick}  // opens the card detail modal via ?card= URL param
/>
```

## Columns

| Column     | Source field      | Notes                           |
|------------|-------------------|---------------------------------|
| Title      | `card.title`      | Clicking opens card detail modal|
| List       | `list.title`      | Resolved from `lists` map       |
| Assignees  | `card.members`    | Avatar initials chips           |
| Labels     | `card.labels`     | Colour chips                    |
| Due Date   | `card.due_date`   | Red text if overdue             |
| Start Date | `card.start_date` | Sprint 46 field                 |
| Value      | `card.amount`     | Formatted with currency prefix  |

## Sorting

- All columns are sortable.
- Clicking a header cycles: **unsorted → ascending → descending → unsorted**.
- Sort is local/client-side only; no API calls are made.
- `useTableSort` performs a stable `localeCompare`-based sort; nulls sort last.

## Data Source

Data comes entirely from the Redux `board` slice populated by `GET /api/v1/boards/:id`.
No additional API endpoint is required.

## Extension Points

- Add column hiding/reordering by extending `TableColumn` with a `visible` flag.
- Add server-side filtering by wiring `useTableSort` to query params.
- Add CSV export by iterating `sortedRows` in a download handler.

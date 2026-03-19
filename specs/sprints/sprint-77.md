# Sprint 77 — Granular Search (Scoped by Type)

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 13 (Search & Presence API), Sprint 22 (Command Palette UI), Sprint 76 (Board Background — board thumbnail in results)

---

## Goal

The current command palette searches all entity types simultaneously and shows results in fixed sections. This sprint adds a **scope selector** in the palette so users can constrain a search to `All`, `Boards` only, or `Cards` only. The server search API already has a `type` query param (Sprint 13) — this sprint wires it up end-to-end and polishes the result sections accordingly.

---

## Scope

### 1. Server — Search API update

**`server/extensions/search/api/search.ts`** (Sprint 13)

Verify the existing `type` param correctly filters results:

```
GET /api/v1/workspaces/:id/search?q=<query>&type=board|card&limit=20&cursor=<id>
```

- `type=board` → query `boards` table only
- `type=card` → query `cards` table only
- `type` omitted → both (existing behaviour)

No DB change needed — the server already supports this. If not implemented, add the `WHERE type IN (...)` branching now.

Ensure responses include `board.background` URL in board results so the client can render thumbnails (Sprint 76 dependency).

---

### 2. Client — Search Scope Selector in Command Palette

**`src/common/components/CommandPalette.tsx`**

Add a tab/pill row below the search input to select the active scope:

```
┌──────────────────────────────────────────────┐
│  🔍  Search cards, boards…                   │
├──────────────────────────────────────────────┤
│  [All]  [Boards]  [Cards]                    │  ← scope tabs
├──────────────────────────────────────────────┤
│  BOARDS                                      │
│  [thumb]  Q3 Roadmap · Acme Corp             │
│  [thumb]  Website Redesign · Acme Corp       │
│                                              │
│  CARDS                                       │
│  ■  Fix login bug  ·  To Do  ·  Q3 Board    │
│  ■  Update README  ·  Done  ·  DevOps        │
│                                              │
│  esc · ↑↓ · ↵                               │
└──────────────────────────────────────────────┘
```

**Scope tab styling:**

```tsx
// Active tab
"px-3 py-1 rounded-full bg-indigo-600 text-white text-sm font-medium"
// Inactive tab
"px-3 py-1 rounded-full text-slate-400 dark:text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 text-sm font-medium transition-colors"
```

**Placement:** pill row sits between the search input and the results list, pinned below the input divider:

```tsx
<div className="flex gap-2 px-5 py-2 border-b border-slate-800 dark:border-slate-800 border-slate-200">
  {(['all', 'board', 'card'] as const).map(scope => (
    <button key={scope} onClick={() => setScope(scope)} className={...}>
      {scope === 'all' ? 'All' : scope === 'board' ? 'Boards' : 'Cards'}
    </button>
  ))}
</div>
```

---

### 3. Scope State & API call

```ts
type SearchScope = 'all' | 'board' | 'card';

const [scope, setScope] = useState<SearchScope>('all');
```

- When scope changes, re-run the search immediately (if query ≥ 2 chars).
- API call:

```ts
const typeParam = scope !== 'all' ? `&type=${scope}` : '';
GET /api/v1/workspaces/${workspaceId}/search?q=${query}${typeParam}&limit=20
```

---

### 4. Result section rendering

| Active scope | Sections rendered |
|---|---|
| `all` | `BOARDS` section + `CARDS` section (current behaviour) |
| `board` | `BOARDS` section only — no `CARDS` header |
| `card` | `CARDS` section only — no `BOARDS` header |

When a section has no results in `all` mode, hide that section entirely (current behaviour).

When `board` or `card` scope has 0 results, show the unified empty state:
```
"No boards found for 'query'"  /  "No cards found for 'query'"
```

---

### 5. Keyboard navigation update

Keyboard navigation (`↑` / `↓`) must work correctly across the scope tabs and results:

- `Tab` / `Shift+Tab` moves focus between the scope pills and the results list.
- Arrow keys within the results list navigate only rows.
- `Enter` on a scope pill changes scope (same as click).
- `Enter` on a result row navigates to the item (existing behaviour).

---

### 6. Scope persistence

The selected scope is persisted in `sessionStorage` (not `localStorage`) so it survives reopening the palette within the same session but resets on a new tab/visit:

```ts
sessionStorage.setItem('searchScope', scope);
```

Restored on palette open:

```ts
const saved = sessionStorage.getItem('searchScope') as SearchScope | null;
setScope(saved ?? 'all');
```

---

### 7. Placeholder text update

Update the input placeholder to reflect the active scope:

| Scope | Placeholder |
|---|---|
| `all` | `Search boards and cards…` |
| `board` | `Search boards…` |
| `card` | `Search cards…` |

---

## Files

| Path | Change |
|---|---|
| `server/extensions/search/api/search.ts` | Verify/add `type` branching in query |
| `src/common/components/CommandPalette.tsx` | Add scope tabs, update API call, result section logic, placeholder |
| `src/common/components/CommandPaletteResult.tsx` | Ensure board results include thumbnail (dependency on Sprint 76) |

---

## Acceptance Criteria

- [ ] Three scope tabs — `All`, `Boards`, `Cards` — appear below the search input in the command palette
- [ ] Selecting `Boards` sends `type=board` to the API and shows only board results
- [ ] Selecting `Cards` sends `type=card` to the API and shows only card results
- [ ] `All` (default) shows both sections as before
- [ ] Changing scope with an active query re-searches immediately
- [ ] Empty results within a selected scope show a scoped empty message
- [ ] Keyboard `Tab` navigates scope tabs; `↑↓` navigates results
- [ ] Selected scope persists in `sessionStorage` for the duration of the browser session
- [ ] Input placeholder text matches the active scope
- [ ] Board results include their background image thumbnail (when available)

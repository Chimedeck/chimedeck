# Sprint 65 — Automation: Rules Builder UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 64 (Automation backend complete), Sprint 18 (Board View — Kanban), Sprint 20 (Real-Time UI)
> **References:** Trello Automation — https://trello.com/guide/automate-anything

---

## Goal

Deliver the board-level Automation panel: a slide-in sidebar accessible from the board header via a dedicated **Heroicon button placed next to the `...` menu**. Inside the panel, users can create, edit, enable/disable, and delete RULE-type automations using a guided trigger + action builder.

---

## Scope

### 1. Automation Button in Board Header

`src/extensions/Automation/components/AutomationHeaderButton.tsx`

- Renders a `BoltIcon` (Heroicons, solid) in the board header toolbar
- Positioned **immediately to the left of the existing `...` (ellipsis) board menu button**
- Clicking it opens the Automation side panel
- Shows a small badge (count bubble) with the number of active automations if > 0

```tsx
// Board header layout (simplified):
<div className="board-header-actions flex items-center gap-2">
  {/* existing actions... */}
  <AutomationHeaderButton />       {/* ← new, left of ... */}
  <BoardMenuButton />              {/* existing ... menu */}
</div>
```

---

### 2. Automation Side Panel

`src/extensions/Automation/components/AutomationPanel/`

```
AutomationPanel/
  index.tsx              # root: slide-in drawer, tabs, header
  AutomationList.tsx     # list of existing rules with enable toggle + edit/delete actions
  AutomationEmptyState.tsx
  RuleBuilder/
    index.tsx            # multi-step builder: Trigger → Actions → Save
    TriggerPicker.tsx    # dropdown: lists all trigger types (from GET /automation/trigger-types)
    TriggerConfig.tsx    # dynamic config fields based on selected trigger type
    ActionList.tsx       # ordered list of added actions + "Add action" button
    ActionPicker.tsx     # dropdown: lists all action types (from GET /automation/action-types)
    ActionConfig.tsx     # dynamic config fields based on selected action type
    ActionItem.tsx       # single action row: drag handle, type label, config summary, delete
    RuleBuilderFooter.tsx # Save / Cancel
```

---

### 3. Panel Tabs

| Tab | Description |
|-----|-------------|
| **Rules** | List of all RULE automations on this board |
| **Buttons** | Placeholder for Sprint 66 (Card & Board Buttons) |
| **Schedule** | Placeholder for Sprint 67 (Scheduled Commands UI) |
| **Log** | Placeholder for Sprint 68 (Run History) |

Unimplemented tabs are visible but show a "Coming soon" state; no broken routes.

---

### 4. Rule Builder UX Flow

1. User clicks **"Create Rule"** in the Rules tab
2. **Step 1 — Trigger:** `TriggerPicker` renders a searchable dropdown of all registered trigger types (fetched from `GET /api/v1/automation/trigger-types`). On selection, `TriggerConfig` renders the appropriate form fields (e.g. a list selector for `card.moved_to_list`).
3. **Step 2 — Actions:** `ActionList` starts empty. User clicks **"Add Action"** to open `ActionPicker`. Selected action appends to the list. `ActionConfig` renders config fields. Users can reorder actions via drag-and-drop (`@dnd-kit/core`, already in project).
4. **Step 3 — Save:** Name field + Save button → `POST /api/v1/boards/:id/automations`
5. On success: panel returns to Rules list, new rule appears at the top with a "Enabled" pill.

---

### 5. Existing Rule Management

`AutomationList` rows show:
- Rule name
- Trigger type label (e.g. "Card moved to list")
- Action count
- Enable/disable toggle (`PATCH ...automations/:id { isEnabled }`)
- Edit button → opens `RuleBuilder` pre-populated
- Delete button → `DELETE ...automations/:id` with confirmation modal

---

### 6. Heroicons Used

| Component | Icon |
|-----------|------|
| `AutomationHeaderButton` | `BoltIcon` (solid, 20px) |
| Panel header | `BoltIcon` (outline, 24px) |
| Close panel | `XMarkIcon` |
| Create rule | `PlusIcon` |
| Enable/disable toggle | `CheckCircleIcon` / `XCircleIcon` |
| Edit rule | `PencilSquareIcon` |
| Delete rule | `TrashIcon` |
| Drag handle | `Bars2Icon` |
| Trigger section | `BoltSlashIcon` (inactive) / `BoltIcon` (active) |
| Action section | `PlayIcon` |

---

### 7. RTK Query Slice

`src/extensions/Automation/api.ts`:
- `getAutomations(boardId)` → `GET /api/v1/boards/:boardId/automations`
- `createAutomation(boardId, payload)` → `POST`
- `updateAutomation(boardId, id, patch)` → `PATCH`
- `deleteAutomation(boardId, id)` → `DELETE`
- `getTriggerTypes()` → `GET /api/v1/automation/trigger-types`
- `getActionTypes()` → `GET /api/v1/automation/action-types`

---

### 8. Files

```
src/extensions/Automation/
  api.ts
  types.ts
  components/
    AutomationHeaderButton.tsx
    AutomationPanel/
      (see §2)
  hooks/
    useAutomationPanel.ts        # open/close panel state (Zustand or local useState)
  reducers.ts                    # (RTK slice for optimistic enable-toggle)
  routes.ts                      # no new routes needed (panel is overlay)
```

---

## Acceptance Criteria

- [ ] `BoltIcon` button appears in the board header, to the left of the `...` menu
- [ ] Clicking the button opens the Automation side panel without navigating away
- [ ] Active automation count badge renders correctly (0 shows no badge)
- [ ] User can create a rule with one trigger and one action in ≤ 5 clicks
- [ ] Trigger type list is fetched from the API (not hardcoded)
- [ ] Action type list is fetched from the API (not hardcoded)
- [ ] Reordering actions via drag-and-drop persists the new order on Save
- [ ] Enable/disable toggle updates `isEnabled` optimistically

---

## Tests

- `tests/e2e/automation/rulesPanel.spec.ts` — open panel, create rule, toggle enable, delete rule

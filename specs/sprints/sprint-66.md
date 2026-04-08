# Sprint 66 — Automation: Card & Board Buttons UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 65 (Automation Panel + Board Header button), Sprint 19 (Card Detail Modal)
> **References:** Automation

---

## Goal

Allow users to create on-demand automation buttons — **card buttons** (appear on every card's back panel and can be triggered per-card) and **board buttons** (appear in the board header and operate on all cards matching a filter). Both use the same action library from Sprint 63.

---

## Scope

### 1. Card Buttons

#### 1a. Server — CARD_BUTTON automation type

`POST /api/v1/boards/:boardId/automations` now accepts `automationType: 'CARD_BUTTON'`. No trigger row is created. When triggered, `context.cardId` is the card the button was pressed on.

New endpoint:

```
POST /api/v1/cards/:cardId/automation-buttons/:automationId/run
```

- Caller must be a board member
- Looks up the CARD_BUTTON automation, runs executor with `{ cardId, boardId, actorId }`
- Returns `{ data: { runLogId, status } }`

#### 1b. UI — Card back "Automation" section

`src/extensions/Automation/components/CardButtons/`

```
CardButtons/
  CardButtonsSection.tsx     # section in card modal: "Automation" heading + list of buttons
  CardButtonItem.tsx         # one button: custom icon (Heroicon) + name → triggers run on click
  AddCardButtonButton.tsx    # "Add button" CTA → opens CardButtonBuilder modal
  CardButtonBuilder.tsx      # modal: name, icon picker, action list (reuses ActionList from Sprint 65)
```

- `CardButtonsSection` renders inside `CardDetailModal` below the checklist section
- Each button shows its custom Heroicon, name, and a loading spinner while running
- After run: show a toast "Button ran successfully" or "Button failed"

#### 1c. Card Button Icon Picker

`src/extensions/Automation/components/shared/IconPicker.tsx`

- Grid of 24 selectable Heroicons (outline), one rendered per button type:

```ts
export const BUTTON_ICONS = [
  'BoltIcon', 'PlayIcon', 'ArrowRightIcon', 'CheckIcon', 'StarIcon',
  'FlagIcon', 'TagIcon', 'UserPlusIcon', 'ClockIcon', 'CalendarIcon',
  'ArchiveBoxIcon', 'ArrowUturnRightIcon', 'ChatBubbleLeftIcon',
  'PaperClipIcon', 'PencilSquareIcon', 'DocumentDuplicateIcon',
  'CheckCircleIcon', 'ExclamationTriangleIcon', 'FireIcon',
  'HandThumbUpIcon', 'RocketLaunchIcon', 'ShieldCheckIcon',
  'SparklesIcon', 'LightBulbIcon',
];
```

---

### 2. Board Buttons

#### 2a. Server — BOARD_BUTTON automation type

`POST /api/v1/boards/:boardId/automations` with `automationType: 'BOARD_BUTTON'`.

Board button actions include a `targetScope` config field:
```json
{ "targetScope": "list", "listId": "..." }  // acts on all cards in a list
{ "targetScope": "board" }                   // acts on all cards on the board
{ "targetScope": "filter", "labelIds": [...], "memberIds": [...] }
```

New endpoint:

```
POST /api/v1/boards/:boardId/automation-buttons/:automationId/run
```

- Resolves the target scope to a list of card IDs
- Runs executor for each card (max 50 cards per run to avoid runaway execution)
- Returns `{ data: { runLogId, cardCount, status } }`

#### 2b. UI — Board header board buttons

`src/extensions/Automation/components/BoardButtons/`

```
BoardButtons/
  BoardButtonsBar.tsx       # horizontal strip of board buttons rendered in board header
  BoardButtonItem.tsx       # icon-only button with tooltip on hover showing name
  BoardButtonBuilder.tsx    # similar builder to CardButtonBuilder with scope selector
```

- `BoardButtonsBar` renders immediately to the left of `AutomationHeaderButton`
- Maximum 5 board buttons shown; overflow indicator if more exist

---

### 3. Automation Panel: Buttons Tab (Sprint 65 placeholder → now live)

`AutomationPanel` `Buttons` tab now renders two sub-sections:

- **Card Buttons**: list all `CARD_BUTTON` automations on the board (shared across all cards)
- **Board Buttons**: list all `BOARD_BUTTON` automations

Each row: icon, name, action-count chip, edit and delete icons.

"Create Card Button" / "Create Board Button" CTAs open the respective builders.

---

### 4. Heroicons Used

| Component | Icon |
|-----------|------|
| Card button default icon | `PlayIcon` |
| Board button default icon | `RectangleGroupIcon` |
| Run in progress (spinner) | `ArrowPathIcon` (animated) |
| Run success toast | `CheckCircleIcon` |
| Run error toast | `ExclamationCircleIcon` |

---

### 5. Files

```
src/extensions/Automation/components/
  CardButtons/
    CardButtonsSection.tsx
    CardButtonItem.tsx
    AddCardButtonButton.tsx
    CardButtonBuilder.tsx
  BoardButtons/
    BoardButtonsBar.tsx
    BoardButtonItem.tsx
    BoardButtonBuilder.tsx
  shared/
    IconPicker.tsx

server/extensions/automation/api/
  runCardButton.ts
  runBoardButton.ts
```

RTK Query additions in `api.ts`:
- `runCardButton(cardId, automationId)` → `POST /api/v1/cards/:id/automation-buttons/:automationId/run`
- `runBoardButton(boardId, automationId)` → `POST /api/v1/boards/:id/automation-buttons/:automationId/run`

---

## Acceptance Criteria

- [ ] Card buttons appear in the "Automation" section of the card modal for every card on the board
- [ ] Clicking a card button triggers the action sequence; loading spinner shown while running
- [ ] Board buttons appear in the board header; clicking runs actions on the target scope
- [ ] Board button run is capped at 50 cards
- [ ] Icon picker shows 24 Heroicon options; selected icon is stored and rendered on the button
- [ ] Buttons tab in Automation panel lists and manages both card and board buttons

---

## Tests

- `tests/e2e/automation/cardButtons.spec.ts` — create button, trigger from card modal, verify result
- `tests/e2e/automation/boardButtons.spec.ts` — create board button, trigger from header, verify list sorted

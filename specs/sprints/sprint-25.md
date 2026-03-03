# Sprint 25 — @Mentions in Cards & Comments

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 11 (Comments), Sprint 19 (Card Modal), Sprint 24 (Nickname)  
> **References:** [requirements §5 — Collaboration](../architecture/requirements.md)

---

## Goal

Allow users to tag board members inside card descriptions and comments by typing `@` followed by a nickname or name. An auto-suggestion dropdown appears as the user types, filtered to members of the current board. Mentions are stored as structured data, rendered as highlighted chips, and trigger notifications (delivered in Sprint 26).

---

## Scope

### 1. Database Migration

```
db/migrations/0016_mentions.ts
```

```sql
CREATE TABLE mentions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type  TEXT NOT NULL,          -- 'card_description' | 'comment'
  source_id    UUID NOT NULL,          -- card_id or comment_id
  mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id, mentioned_user_id)
);

CREATE INDEX mentions_mentioned_user_idx ON mentions (mentioned_user_id);
CREATE INDEX mentions_source_idx ON mentions (source_type, source_id);
```

No soft-delete — mentions are re-derived on each save.

### 2. Mention Parsing Utility (Shared)

```
server/common/
  mentions/
    parse.ts    # extractMentions(text: string): string[]  — returns @-prefixed nicknames
    resolve.ts  # resolveNicknames(nicknames: string[], boardId: string): Promise<User[]>
```

`extractMentions` uses a regex: `/\B@([\w-]{1,50})/g`

`resolveNicknames` queries `users` joined with `board_members` to verify the mentioned user is a board member (no cross-board tagging).

### 3. Server — Mention Sync on Save

On card description save (`PATCH /api/v1/cards/:id`) and on comment create/edit:

1. Parse mentions from the new text
2. Resolve nicknames to user IDs (board members only)
3. Delete existing `mentions` rows for this `(source_type, source_id)`
4. Insert new `mentions` rows
5. Emit `mention_created` events for **newly added** mentioned users (diff between old and new sets)

The mention sync is wrapped in the same DB transaction as the parent save.

### 4. Server — Member Suggestions Endpoint

```
server/extensions/board/api/
  members/
    suggestions.ts   # GET /api/v1/boards/:boardId/members/suggestions?q=<query>
```

Returns board members whose `nickname` or `name` starts with `q` (case-insensitive), limit 10.

Response:
```json
{
  "data": [
    { "id": "uuid", "nickname": "jane_k", "name": "Jane Kim", "avatar_url": "..." }
  ]
}
```

Used by the client autocomplete dropdown.

### 5. Client — `MentionInput` Component

```
src/common/
  components/
    MentionInput/
      MentionInput.tsx          # textarea with @mention detection + dropdown
      MentionSuggestions.tsx    # floating dropdown list of matching members
      MentionChip.tsx           # rendered @mention highlight within display text
      useMentionInput.ts        # hook: detects @trigger, debounces query, manages selection
      renderMentions.tsx        # converts plain text with @mentions to JSX with chips
```

#### Behaviour

1. User types `@` in any `<textarea>` (card description or comment editor)
2. Hook captures the `@<partial>` trigger word
3. After 150 ms debounce: `GET /boards/:boardId/members/suggestions?q=<partial>`
4. `MentionSuggestions` dropdown appears below the cursor position:
   - Avatar + nickname + name for each result
   - Keyboard: `↑↓` to navigate, `Enter`/`Tab` to select, `Escape` to dismiss
5. On selection: inserts `@nickname` into the textarea and closes the dropdown
6. No suggestions found: dropdown hides (no "no results" shown, to keep flow unobtrusive)

#### `MentionSuggestions` Styling

```
absolute z-50
bg-slate-800 border border-slate-700 rounded-lg shadow-xl
min-w-[220px] max-h-[260px] overflow-y-auto
```

Row:
```
flex items-center gap-2 px-3 py-2 cursor-pointer
hover:bg-slate-700 aria-selected:bg-slate-700
```

Avatar: 28×28 px rounded-full; initials fallback on `bg-indigo-600`.

#### `MentionChip` (display rendering)

When **rendering** saved text (not editing), `@nickname` tokens are replaced with:
```html
<span class="inline-flex items-center gap-1 rounded-full bg-indigo-900/50 px-1.5 py-0.5
             text-indigo-300 text-xs font-medium cursor-pointer hover:bg-indigo-900">
  @nickname
</span>
```

Hovering a chip shows a tooltip with the user's full name and avatar.

### 6. Integration into Existing Editors

#### Card Description

`CardDescriptionEditor.tsx` (Sprint 19) — replace bare `<textarea>` with `<MentionInput>`, passing `boardId` as prop so the hook knows which members to suggest.

#### Comment Editor

`CommentEditor.tsx` (Sprint 21) — same replacement.

Both components already call `onSubmit(content: string)` — the text content (with plain `@nickname` markers) is passed through unchanged; the server parses them on save.

### 7. Data Storage Format

Mentions are stored as plain `@nickname` markers inline in the text column (card `description` / comment `content`). The `mentions` table is a derived index for efficient notification lookup — it is always re-derived on save.

---

## Data Model

```
mentions
├── id                    UUID PK
├── source_type           TEXT ('card_description' | 'comment')
├── source_id             UUID
├── mentioned_user_id     UUID → users.id
├── mentioned_by_user_id  UUID → users.id
└── created_at            TIMESTAMPTZ
```

---

## API Routes Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/boards/:boardId/members/suggestions` | JWT | Autocomplete members by query |
| `PATCH` | `/api/v1/cards/:id` | JWT | Updated: syncs mentions on description save |
| `POST` | `/api/v1/cards/:cardId/comments` | JWT | Updated: syncs mentions on comment create |
| `PATCH` | `/api/v1/comments/:id` | JWT | Updated: syncs mentions on comment edit |

---

## Acceptance Criteria

- [ ] Typing `@` in a card description textarea shows a suggestion dropdown with board members
- [ ] Suggestions filter as the user continues typing; keyboard navigation works
- [ ] Selecting a suggestion inserts `@nickname` and closes the dropdown
- [ ] Pressing `Escape` dismisses the dropdown without inserting anything
- [ ] Saved descriptions and comments render `@nickname` as highlighted chips
- [ ] Hovering a chip shows the user's name in a tooltip
- [ ] Users who are not members of the board are not returned in suggestions
- [ ] Multiple `@mentions` can appear in a single description or comment
- [ ] Editing a description re-parses mentions; removed mentions are deleted from the `mentions` table
- [ ] `GET /boards/:boardId/members/suggestions?q=ja` returns members whose nickname/name starts with "ja"

---

## Tests

```
specs/tests/
  mentions-autocomplete.md   # Playwright: type @j → dropdown appears → select → text inserted
  mentions-rendering.md      # Playwright: save description with @mention → chip renders on re-open
  mentions-db.md             # Integration: save card with two @mentions → mentions table has 2 rows
```

---

## Files

```
db/migrations/0016_mentions.ts
server/common/mentions/parse.ts
server/common/mentions/resolve.ts
server/extensions/board/api/members/suggestions.ts
server/extensions/card/api/update.ts                  (updated — mention sync)
server/extensions/comment/api/create.ts               (updated — mention sync)
server/extensions/comment/api/update.ts               (updated — mention sync)
src/common/components/MentionInput/MentionInput.tsx
src/common/components/MentionInput/MentionSuggestions.tsx
src/common/components/MentionInput/MentionChip.tsx
src/common/components/MentionInput/useMentionInput.ts
src/common/components/MentionInput/renderMentions.tsx
src/extensions/Card/components/CardDescriptionEditor.tsx  (updated)
src/extensions/Comment/components/CommentEditor.tsx       (updated)
```

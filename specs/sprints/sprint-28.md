# Sprint 28 — Member Avatar Popover on Card Tiles

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 07 (Card members), Sprint 15 (User profiles)  
> **References:** [requirements §3 — Board, §7 — User Profiles](../architecture/requirements.md)

---

## Goal

When a user clicks any member avatar on a card tile (or inside the card modal's member row), a small profile popover appears. The popover shows the member's avatar, display name, and username handle. Its action buttons are context-aware:

- **If the avatar belongs to the currently logged-in user** → show an **"Edit profile info"** button that navigates to `/profile/edit`.
- **If the avatar belongs to another user** → show a **"Remove from card"** button that detaches them from the card.

---

## Scope

### 1. UI — `MemberAvatarPopover` component (new)

```
src/extensions/Card/components/MemberAvatarPopover.tsx
```

#### Props

```ts
interface MemberAvatarPopoverProps {
  member: {
    id: string;
    name: string | null;
    email: string;
    nickname?: string | null;
    avatar_url?: string | null;
  };
  isSelf: boolean;
  onRemove?: () => Promise<void> | void;  // called when "Remove from card" is clicked
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;  // used to position the popover
}
```

#### Layout

```
┌────────────────────────────────┐
│  [X]  close button (top right) │
│                                │
│   ┌───────────┐                │
│   │  avatar   │  Name          │
│   │  (40×40)  │  @nickname     │
│   └───────────┘                │
│                                │
│  [Edit profile info]           │  ← isSelf=true
│  [Remove from card]            │  ← isSelf=false
└────────────────────────────────┘
```

- Rendered in a `fixed`-positioned container, positioned relative to the clicked avatar using `getBoundingClientRect()` of `anchorRef`.
- Closes on `Escape` key or click-outside (use a `useClickOutside` hook / `mousedown` listener on `document`).
- Z-index `z-50`.
- Background: `bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 w-56`.
- Avatar: if `avatar_url` is present render `<img>`; otherwise render initials in a coloured circle (same logic as `CardMemberAvatars`).
- Name: `text-sm font-semibold text-white`.
- Nickname/handle: `text-xs text-slate-400` prefixed with `@`; fall back to email if no nickname.
- Action button style:
  - "Edit profile info": `w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-700 text-slate-200`
  - "Remove from card": `w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-900/40 text-red-400`
- Show a loading spinner inside the "Remove" button while the async `onRemove` call is in flight; disable button to prevent double clicks.

---

### 2. UI — Update `CardMemberAvatars`

File: `src/extensions/Card/components/CardMemberAvatars.tsx`

- Each avatar `<span>` becomes a `<button>` (keep same visual but add `onClick`).
- On click: set local state `{ member, anchorRef }` and render `<MemberAvatarPopover>`.
- Requires knowing the current user's id to pass `isSelf`.
- Prop additions:

```ts
interface Props {
  members: CardMember[];
  maxVisible?: number;
  cardId: string;               // needed for remove action
  currentUserId: string;        // to determine isSelf
  onRemoveMember?: (cardId: string, memberId: string) => Promise<void>;
}
```

> The `onRemoveMember` callback should already exist from Sprint 07; wire it through here.

---

### 3. UI — Read `currentUserId` from auth state

`CardMemberAvatars` is used in:
- `src/extensions/Card/components/CardItem.tsx` (card tile)
- The card modal members section (wherever `CardMemberAvatars` is rendered inside the modal)

In both call sites, read `currentUserId` from the Redux auth slice (e.g. `useSelector(state => state.auth.user?.id)`) and pass it down.

---

### 4. UI — "Edit profile info" navigation

Clicking "Edit profile info" in the popover navigates to `/profile/edit` using `react-router-dom`'s `useNavigate`. The popover closes automatically after navigation.

If a `/profile/edit` route does not yet exist, create a stub page:

```
src/extensions/UserProfile/containers/EditProfilePage/
  EditProfilePage.tsx   — placeholder "Edit Profile" heading + back link
```

Register it in the router. No backend work needed in this sprint; full profile editing is out of scope.

---

### 5. Server — `DELETE /api/v1/cards/:cardId/members/:memberId`

> Only implement if this endpoint does not already exist from Sprint 07.

File: `server/extensions/card/api/removeMember.ts`

```
DELETE /api/v1/cards/:cardId/members/:memberId
```

- Authenticated. Caller must be a member of the board the card belongs to.
- Deletes the row from `card_members` where `card_id = :cardId AND user_id = :memberId`.
- Returns `{ data: { cardId, memberId } }`.
- Emits a real-time WS event to the board channel:
  ```json
  { "type": "card_member_removed", "payload": { "cardId": "...", "memberId": "..." } }
  ```

---

## Acceptance Criteria

1. **Clicking own avatar** opens the popover with "Edit profile info" and no "Remove" button.
2. **Clicking another member's avatar** opens the popover with their name/handle and a "Remove from card" button.
3. **Remove action** detaches the member from the card; the avatar disappears from the tile without a full page reload.
4. **"Edit profile info"** navigates to `/profile/edit`.
5. **Close behaviour** — the popover closes on Escape, click-outside, and after successful remove.
6. **Loading state** — "Remove" button shows spinner and is disabled while the API call is in flight.
7. **Accessibility** — popover is focusable and traps focus, close button has `aria-label="Close"`.
8. **No avatar overflow button** — the `+N` overflow chip must **not** show a popover (it is not a member).

---

## Files

### New
- `src/extensions/Card/components/MemberAvatarPopover.tsx`
- `src/extensions/UserProfile/containers/EditProfilePage/EditProfilePage.tsx` *(stub, if route missing)*

### Modified
- `src/extensions/Card/components/CardMemberAvatars.tsx`
- `src/extensions/Card/components/CardItem.tsx` (pass `currentUserId`, `cardId`, `onRemoveMember`)
- Card modal members section (same `CardMemberAvatars` wiring)
- `src/routing/` or equivalent router file (add `/profile/edit` route if missing)
- `server/extensions/card/api/index.ts` + `removeMember.ts` *(only if endpoint missing)*

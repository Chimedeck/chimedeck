# Sprint 24 — Profile Settings: Avatar & Nickname

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Auth), Sprint 12 (S3 upload infra), Sprint 17 (App shell)  
> **References:** [requirements §3 — User profile](../architecture/requirements.md)

---

## Goal

Give users a dedicated profile settings page where they can upload or remove an avatar and update their display nickname. Avatar images are stored in S3 (reusing the attachment upload infra from Sprint 12); nicknames are stored on the `users` table. Both changes propagate in real time to avatars shown on boards and sidebars.

---

## Scope

### 1. Database Migration

```
db/migrations/0015_user_profile.ts
```

```sql
ALTER TABLE users
  ADD COLUMN nickname    TEXT,         -- display name, max 50 chars
  ADD COLUMN avatar_url  TEXT;         -- absolute URL to uploaded image or null
```

`nickname` falls back to `name` or `email` where displayed.

### 2. Server — Profile API

```
server/extensions/users/api/
  profile/
    get.ts      # GET  /api/v1/users/me
    update.ts   # PATCH /api/v1/users/me
  avatar/
    upload.ts   # POST  /api/v1/users/me/avatar
    remove.ts   # DELETE /api/v1/users/me/avatar
```

#### `GET /api/v1/users/me`

Returns the current user's profile.

Response:
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "nickname": "jane",
    "avatar_url": "https://cdn.example.com/avatars/uuid.jpg",
    "email_verified": true,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

#### `PATCH /api/v1/users/me`

Update `nickname` and/or `name`.

Request body:
```json
{ "nickname": "jane_k", "name": "Jane Kim" }
```

Validation:
- `nickname`: 1–50 chars, alphanumeric + underscores + hyphens, unique across workspace — error `{ name: 'nickname-taken' }` 409
- `name`: 1–100 chars

Returns updated user object: `{ data: <user> }`.

#### `POST /api/v1/users/me/avatar`

`multipart/form-data` with field `avatar` (image file).

- Accept: `image/jpeg`, `image/png`, `image/webp`, `image/gif` — max 5 MB
- Resize to 256×256 px square cover crop on the server (using `sharp`)
- Upload to S3 at key `avatars/<userId>.<ext>`
- Update `users.avatar_url`
- Delete old avatar from S3 if one existed
- Returns `{ data: { avatar_url: "..." } }`

Error shape for invalid file:
```json
{ "name": "invalid-avatar-file", "data": { "message": "File must be an image under 5 MB" } }
```

#### `DELETE /api/v1/users/me/avatar`

- Deletes file from S3
- Sets `users.avatar_url = null`
- Returns `204 No Content`

### 3. Server — Image Processing Module

```
server/mods/
  imageProcessor/
    index.ts    # resizeAvatar({ buffer, mimeType }) → Promise<Buffer>
```

Uses `sharp` for resizing. When `sharp` is unavailable (e.g. in test env), stores original unchanged.

### 4. Client — Profile Settings Page

```
src/extensions/User/
  containers/
    ProfilePage/
      ProfilePage.tsx
      ProfilePage.duck.ts
  components/
    AvatarUploader.tsx        # drag-drop or click-to-upload avatar widget
    NicknameField.tsx         # inline-editable nickname with validation
    ProfileForm.tsx           # wraps nickname + name fields with save button
```

**Route:** `/settings/profile` (inside `AppShell`, accessible from sidebar user menu)

**Layout:**

```
┌─────────────────────────────────────────┐
│  Profile Settings                       │
│                                         │
│  [  Avatar  ]                           │
│  ┌──────────┐                           │
│  │  128×128 │  Change photo             │
│  │  avatar  │  Remove photo             │
│  └──────────┘                           │
│                                         │
│  Display Name                           │
│  ┌──────────────────────────┐           │
│  │  Jane Kim                │           │
│  └──────────────────────────┘           │
│                                         │
│  Nickname (used for @mentions)          │
│  ┌──────────────────────────┐           │
│  │  @jane_k                 │           │
│  └──────────────────────────┘           │
│                                         │
│  [ Save Changes ]                       │
└─────────────────────────────────────────┘
```

**`AvatarUploader`:**
- Shows current avatar or initials placeholder
- Click → file `<input accept="image/*">` picker
- Drag-and-drop onto avatar area
- Displays upload progress bar
- On success: updates displayed avatar immediately (optimistic)
- "Remove photo" button calls `DELETE /users/me/avatar`

**`NicknameField`:**
- Shows `@` prefix
- Validates format client-side (alphanum/underscore/hyphen)
- Duplicate nickname shows inline error from server 409

### 5. Sidebar Avatar Update

Update `Sidebar.tsx` to display `avatar_url` (with initials fallback) and show `nickname ?? name ?? email` as the user's display name in the bottom user menu.

### 6. Client — Duck / Slice

`ProfilePage.duck.ts` manages:

```ts
interface ProfileState {
  user: UserProfile | null;
  status: 'idle' | 'loading' | 'saving' | 'error';
  avatarUploading: boolean;
  error: SerializedError | null;
}
```

Thunks:
- `fetchProfileThunk` → `GET /users/me`
- `updateProfileThunk({ nickname, name })` → `PATCH /users/me`
- `uploadAvatarThunk({ file })` → `POST /users/me/avatar`
- `removeAvatarThunk` → `DELETE /users/me/avatar`

### 7. Translations

```
src/extensions/User/translations/en.json
```

```json
{
  "ProfilePage.title": "Profile Settings",
  "ProfilePage.avatar": "Avatar",
  "ProfilePage.changePhoto": "Change photo",
  "ProfilePage.removePhoto": "Remove photo",
  "ProfilePage.displayName": "Display Name",
  "ProfilePage.nickname": "Nickname",
  "ProfilePage.nicknamePlaceholder": "@your_nickname",
  "ProfilePage.nicknameHint": "Used for @mentions in cards and comments",
  "ProfilePage.saveChanges": "Save Changes",
  "ProfilePage.saved": "Profile updated.",
  "ProfilePage.nicknameTaken": "This nickname is already taken.",
  "ProfilePage.invalidFile": "Please upload a JPEG, PNG, WebP or GIF under 5 MB."
}
```

---

## Data Model

```
users (updated)
├── nickname    TEXT (nullable, unique, max 50)
└── avatar_url  TEXT (nullable)
```

---

## API Routes Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/users/me` | JWT | Get current user profile |
| `PATCH` | `/api/v1/users/me` | JWT | Update nickname / name |
| `POST` | `/api/v1/users/me/avatar` | JWT | Upload new avatar image |
| `DELETE` | `/api/v1/users/me/avatar` | JWT | Remove avatar |

---

## Acceptance Criteria

- [ ] User can navigate to `/settings/profile` from the sidebar
- [ ] Uploading a valid image updates the avatar in the sidebar and profile page immediately
- [ ] Non-image files and files > 5 MB are rejected with a clear error message
- [ ] Removing the avatar shows the initials placeholder
- [ ] Saving a new nickname updates it throughout the app
- [ ] Duplicate nickname shows a `409` inline error without losing the current input
- [ ] Changes persist across page reload
- [ ] Sidebar shows the user's avatar and nickname/name

---

## Tests

```
specs/tests/
  profile-avatar.md     # Playwright: upload avatar → verify it appears in sidebar
  profile-nickname.md   # Playwright: set nickname → verify @mention shows new nickname
```

---

## Files

```
db/migrations/0015_user_profile.ts
server/extensions/users/api/profile/get.ts
server/extensions/users/api/profile/update.ts
server/extensions/users/api/avatar/upload.ts
server/extensions/users/api/avatar/remove.ts
server/mods/imageProcessor/index.ts
src/extensions/User/containers/ProfilePage/ProfilePage.tsx
src/extensions/User/containers/ProfilePage/ProfilePage.duck.ts
src/extensions/User/components/AvatarUploader.tsx
src/extensions/User/components/NicknameField.tsx
src/extensions/User/components/ProfileForm.tsx
src/extensions/User/translations/en.json
src/extensions/Workspace/components/Sidebar.tsx   (updated — avatar + nickname)
src/routing/index.tsx                              (updated — add /settings/profile route)
```

# Sprint 102 — API Token UI (User Settings)

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 101 (API Token Infrastructure), Sprint 96 (Profile Notifications Tab — establishes the settings tab pattern)

---

## Goal

Expose a self-service UI inside User Settings where a user can create, view, and revoke their API tokens. The experience mirrors the pattern used by GitHub / Linear:

1. Click "Generate new token" → fill in name + optional expiry → token shown once in a copy modal.
2. Existing tokens listed in a table with name, prefix (`hf_3a7b...`), created date, last-used date, and expiry.
3. Revoke button per row with a confirmation dialog.

---

## Acceptance Criteria

- [ ] "API Tokens" tab (or section) appears in User Settings
- [ ] User can generate a token with a name and optional expiry date
- [ ] Raw token is shown exactly once in a copy-to-clipboard modal immediately after creation
- [ ] Token list shows prefix, name, created, last used, expiry (or "Never")
- [ ] User can revoke any of their tokens with a confirmation step
- [ ] After revocation the token disappears from the list
- [ ] Email column / last-used updates on next page load (no real-time required)
- [ ] RTK Query cache is invalidated correctly after create/revoke

---

## Scope

### 1. RTK Query slice

**`src/extensions/ApiToken/apiToken.slice.ts`**

```ts
export const apiTokenApi = createApi({
  reducerPath: 'apiTokenApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1', credentials: 'include' }),
  tagTypes: ['ApiToken'],
  endpoints: (builder) => ({
    listTokens: builder.query<ApiTokenItem[], void>({
      query: () => '/tokens',
      transformResponse: (res: { data: ApiTokenItem[] }) => res.data,
      providesTags: ['ApiToken'],
    }),
    createToken: builder.mutation<CreateTokenResponse, CreateTokenBody>({
      query: (body) => ({ url: '/tokens', method: 'POST', body }),
      invalidatesTags: ['ApiToken'],
    }),
    revokeToken: builder.mutation<void, string>({
      query: (id) => ({ url: `/tokens/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ApiToken'],
    }),
  }),
});
```

Types:
```ts
interface ApiTokenItem {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CreateTokenBody {
  name: string;
  expiresAt?: string | null;
}

interface CreateTokenResponse {
  data: ApiTokenItem & { token: string }; // raw token returned once
}
```

---

### 2. `ApiTokenPage` container

**`src/extensions/ApiToken/containers/ApiTokenPage/`**

```
ApiTokenPage/
  ApiTokenPage.tsx           # main page — lists tokens + "Generate" button
  GenerateTokenModal.tsx     # form: name + expiry date picker → calls createToken
  TokenCreatedModal.tsx      # shows the raw token + copy button (opens after generate)
  RevokeTokenDialog.tsx      # confirmation before calling revokeToken
```

#### `ApiTokenPage.tsx`

- Fetches `listTokens`.
- Renders a table with columns: Name, Token prefix, Created, Last used, Expires, Actions.
- "Generate new token" button opens `GenerateTokenModal`.

#### `GenerateTokenModal.tsx`

Fields:
- **Token name** (text, required)
- **Expiry** — date picker or "No expiry" radio (default: no expiry)

On submit: calls `createToken`; on success closes this modal and opens `TokenCreatedModal` with the raw token.

#### `TokenCreatedModal.tsx`

- Shows the raw `hf_...` token in a monospace read-only input.
- "Copy" button copies to clipboard.
- Bold warning: "This token will not be shown again."
- "Done" closes the modal.

#### `RevokeTokenDialog.tsx`

- Confirms: "Revoke token {name}? Any scripts or apps using it will stop working."
- On confirm: calls `revokeToken`.

---

### 3. Route + navigation

**`src/extensions/ApiToken/routes.ts`**

Register `/settings/api-tokens` page route.

**`src/containers/UserSettings/UserSettings.tsx`** (or equivalent settings nav):

Add "API Tokens" nav item linking to `/settings/api-tokens`.

---

### 4. Translations

**`src/extensions/ApiToken/translations/en.json`**

```json
{
  "ApiTokenPage.title": "API Tokens",
  "ApiTokenPage.description": "Tokens allow external tools and scripts to authenticate as you.",
  "ApiTokenPage.generateButton": "Generate new token",
  "ApiTokenPage.tableNameCol": "Name",
  "ApiTokenPage.tablePrefixCol": "Token",
  "ApiTokenPage.tableCreatedCol": "Created",
  "ApiTokenPage.tableLastUsedCol": "Last used",
  "ApiTokenPage.tableExpiresCol": "Expires",
  "ApiTokenPage.neverExpires": "Never",
  "ApiTokenPage.noLastUsed": "Never used",
  "GenerateTokenModal.title": "Generate new token",
  "GenerateTokenModal.namePlaceholder": "e.g. CI pipeline, local dev",
  "GenerateTokenModal.expiryLabel": "Expiry",
  "GenerateTokenModal.noExpiry": "No expiry",
  "GenerateTokenModal.submit": "Generate token",
  "TokenCreatedModal.title": "Your new token",
  "TokenCreatedModal.warning": "This token will not be shown again. Copy it now.",
  "TokenCreatedModal.copyButton": "Copy",
  "TokenCreatedModal.copiedButton": "Copied!",
  "TokenCreatedModal.doneButton": "Done",
  "RevokeTokenDialog.title": "Revoke token?",
  "RevokeTokenDialog.body": "Any scripts or apps using \"{name}\" will stop working immediately.",
  "RevokeTokenDialog.confirm": "Revoke",
  "RevokeTokenDialog.cancel": "Cancel"
}
```

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/ApiToken/apiToken.slice.ts` | New RTK Query slice |
| `src/extensions/ApiToken/containers/ApiTokenPage/ApiTokenPage.tsx` | New page component |
| `src/extensions/ApiToken/containers/ApiTokenPage/GenerateTokenModal.tsx` | Generate form modal |
| `src/extensions/ApiToken/containers/ApiTokenPage/TokenCreatedModal.tsx` | One-time token display modal |
| `src/extensions/ApiToken/containers/ApiTokenPage/RevokeTokenDialog.tsx` | Revoke confirmation dialog |
| `src/extensions/ApiToken/routes.ts` | Route registration |
| `src/extensions/ApiToken/translations/en.json` | Translation keys |
| `src/containers/UserSettings/UserSettings.tsx` | Add "API Tokens" nav link |
| `src/reducers.ts` | Register apiTokenApi reducer |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | Open `/settings/api-tokens` | Token list renders (empty state shown if none) |
| T2 | Click "Generate new token" → fill name → submit | Modal closes; TokenCreatedModal opens; raw token displayed |
| T3 | Copy token in TokenCreatedModal | Clipboard receives the `hf_...` value |
| T4 | Close TokenCreatedModal → check list | New token row appears (prefix shown, no raw value) |
| T5 | Click Revoke → confirm | Token row removed from list |
| T6 | Click Revoke → cancel | Token row remains |

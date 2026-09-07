# Sprint 143 — Smart Links: Card Description & Comment UI

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 142 (Smart Link connections infrastructure), Sprint 19 (Card detail modal), Sprint 21 (Comments UI), Sprint 11 (Comments API)

---

## Goal

When a URL appears in a **card description** or **card comment** — in view or edit mode — the system applies one of three behaviours based on the URL and the user's account state:

| Condition | Behaviour |
|---|---|
| `SMART_LINKS_ENABLED` is `false` **or** user has opted out (`smart_links_opt_in = false`) **or** URL is not a recognised provider | **Old behaviour** — plain `<a>` link, existing `enrichExternalLinkChips` pipeline, no change |
| URL is a recognised provider **and** user **has** connected that account | **SmartLinkPreview** — title, service icon, type badge, subtitle (last modified, PR status, etc.) |
| URL is a recognised provider **and** user has **not** connected that account | **ConnectAccountPrompt** — "Connect your [Platform] account" button that starts the OAuth flow |

The UI never blocks rendering — resolution happens asynchronously after the content is painted.

---

## Feature Flag

Reuses `SMART_LINKS_ENABLED` from Sprint 142. When `false`, **nothing in this sprint activates** — all URLs render via the existing plain-link pipeline exactly as they do today.

The per-user **`smart_links_opt_in`** flag (default `true`, toggled via `PATCH /api/v1/smart-links/preference`) lets individual users disable smart links for themselves without affecting anyone else. The client reads `metadata.userOptIn` from the `GET /api/v1/smart-links/providers` response on boot and skips the entire smart links pipeline for that user when it is `false`.

---

## Behaviour Decision Tree

```
For each URL detected in description / comment content:

  SMART_LINKS_ENABLED = false?
  └─ YES → old behaviour (plain link + enrichExternalLinkChips) — STOP
  └─ NO  →
        user has opted in? (smart_links_opt_in = true, from GET /providers metadata.userOptIn)
        └─ NO  → old behaviour (plain link + enrichExternalLinkChips) — STOP
        └─ YES →
              detectProvider(url) = null?
              └─ YES → old behaviour (plain link + enrichExternalLinkChips) — STOP
              └─ NO  →
                    provider is configured? (configured: true in GET /providers response)
                    └─ NO  → old behaviour (plain link + enrichExternalLinkChips) — STOP
                    └─ YES →
                          user has connected account for this provider?
                          └─ YES → render SmartLinkPreview (title, icon, type badge, subtitle)
                          └─ NO  → render ConnectAccountPrompt ("Connect your [Platform] account")
```

**Important:** The "old behaviour" path is genuinely unchanged — the existing `enrichExternalLinkChips` call is not skipped, not replaced, and not wrapped. `SmartLinkWrapper` only renders for URLs that pass both checks above.

---

## Folder / File Layout

### New files (SmartLinks extension)

```
src/extensions/SmartLinks/
├── components/
│   ├── SmartLinkPreview.tsx        ← resolved: icon, title, type badge, subtitle, external link arrow
│   ├── ConnectAccountPrompt.tsx    ← requires_connection: provider icon, copy, CTA button
│   └── SmartLinkWrapper.tsx       ← orchestrator: calls useSmartLink, renders one of the above or null
├── hooks/
│   └── useSmartLink.ts            ← per-URL async resolution hook (cached in RTK Query)
├── api.ts                         ← RTK Query: resolveSmartLink + getSmartLinkProviders
├── slices/
│   └── smartLinks.duck.ts         ← Redux slice: connected provider list
├── utils/
│   └── detectProvider.ts          ← lightweight client-side URL classifier (provider key or null)
└── translations/
    └── en.json
```

### Existing files — modify only, do not recreate

```
src/extensions/Card/components/CardDescriptionTiptap.tsx
  ├── view mode  → scan previewHtml for provider URLs; render <SmartLinkWrapper> for each below the preview button
  └── edit mode  → track last provider URL from TipTap editor content; render one <SmartLinkWrapper> below the editor

src/extensions/Comment/components/CommentItem.tsx
  └── view mode  → scan rendered HTML (same pass as enrichExternalLinkChips) for provider URLs;
                   render <SmartLinkWrapper> for each below the comment body div

src/extensions/Comment/components/CommentEditor.tsx
  └── edit mode  → track last provider URL from TipTap editor content; render one <SmartLinkWrapper> below the editor

src/extensions/UserProfile/containers/EditProfilePage/EditProfilePage.tsx  (or equivalent settings page)
  └── add "Smart Links" toggle row: reads userOptIn from Redux, calls PATCH /api/v1/smart-links/preference on change
```

#### Opt-in toggle

Add a toggle row to the user's profile settings page under a new "Integrations" section (or alongside existing preferences):

```
Smart Links
Enable rich previews for Google, Figma, Slack, GitHub, and other supported links
[toggle — on by default]
```

- Reads `userOptIn` from `smartLinks.duck.ts` (populated by `getSmartLinkProviders`).
- On change: dispatch optimistic update to slice, then call `PATCH /api/v1/smart-links/preference`.
- On error: roll back the optimistic update and show a toast.
- When toggled off, `SmartLinkWrapper` renders nothing immediately (no page reload required).

---

## Component Specification

### `SmartLinkWrapper.tsx`

**Props:**
```ts
interface SmartLinkWrapperProps {
  url: string;
}
```

**Behaviour:**
1. If `SMART_LINKS_ENABLED` is false or `detectProvider(url)` returns `null` — render nothing; the caller's existing link pipeline handles the URL.
2. On mount, call `useSmartLink(url)` to trigger resolution.
3. While pending: render a compact skeleton row (pulsing grey bar, same height as the resolved card).
4. On `requiresConnection: false` (user is connected): render `<SmartLinkPreview>`.
5. On `requiresConnection: true` (provider recognised but user not connected): render `<ConnectAccountPrompt>` with button label "Connect your [Platform] account".
6. On error: render nothing — the plain link in the surrounding HTML remains visible.

**In view mode** (`CardDescriptionTiptap` + `CommentItem`): the existing `useEffect` that already calls `enrichExternalLinkChips` is extended to scan the rendered HTML for provider URLs. Detected URLs are stored in local state and rendered as `<SmartLinkWrapper>` elements below the content block. The `dangerouslySetInnerHTML` pipeline is left untouched.

**In edit mode** (`CardDescriptionTiptap` + `CommentEditor`): the existing `onUpdate` TipTap callback is extended with a debounced 600 ms scan. The last detected provider URL is stored in local state and rendered as a single `<SmartLinkWrapper>` below the editor's `InlineUploadPreview` block.

---

### `SmartLinkPreview.tsx`

```
┌──────────────────────────────────────────────────────────┐
│  [icon]  Q4 Marketing Strategy          [Google Doc] [↗] │
│          Last modified 2 days ago                        │
└──────────────────────────────────────────────────────────┘
```

**Props:**
```ts
interface SmartLinkPreviewProps {
  url: string;
  title: string;
  subtitle: string | null;
  iconUrl: string | null;
  linkType: string;
}
```

- `[↗]` is a small `ArrowTopRightOnSquareIcon` (Heroicons) that opens the URL in a new tab.
- `linkType` badge uses a muted pill style (`text-xs rounded bg-gray-100 dark:bg-gray-700`).
- The entire card is NOT clickable as a block — only the `↗` icon opens the URL, to prevent accidental navigation during card editing.

---

### `ConnectAccountPrompt.tsx`

```
┌──────────────────────────────────────────────────────────┐
│  [provider icon]  Connect your Slack account               │
│                   [Connect your Slack account →]          │
└──────────────────────────────────────────────────────────┘
```

Button label is always **"Connect your [Platform] account"** — e.g. "Connect your Google Workspace account", "Connect your Slack account", "Connect your GitHub account".

**Props:**
```ts
interface ConnectAccountPromptProps {
  provider: string;         // e.g. "slack"
  providerDisplayName: string;  // e.g. "Slack"
  iconUrl: string | null;
  onConnect: () => void;
}
```

**`onConnect`** calls `GET /api/v1/smart-links/connect/:provider` by navigating to that URL (the server responds with a redirect to the provider's OAuth page). After the user completes OAuth and is redirected back, the resolved preview replaces the prompt automatically (the slice is invalidated on return).

The prompt must be rendered in both **view mode** (below the link in the comment/description body) and **edit mode** (below the editor). In edit mode it is informational only — no action is taken during editing unless the user explicitly clicks "Connect".

---

### `useSmartLink.ts`

```ts
export function useSmartLink(url: string): {
  data: SmartLinkResolution | null;
  isLoading: boolean;
  isError: boolean;
}
```

- Uses RTK Query `resolveSmartLink` endpoint from `api.ts`.
- Only called when `SMART_LINKS_ENABLED` is true, the user has opted in (`userOptIn = true`), **and** `detectProvider(url)` returns non-null. All other cases return `{ data: null, isLoading: false, isError: false }` immediately without a network call.
- Results are cached in Redux by URL. A second component for the same URL reuses the cached result without a second network call.

---

### `detectProvider.ts`

Lightweight pattern matcher (no network calls) that classifies a URL string into a provider key or `null`. Used client-side to decide whether to render `SmartLinkWrapper` at all before the async resolve completes.

```ts
export function detectProvider(url: string): string | null
// Returns: "google" | "figma" | "slack" | "dropbox" | "box" | "microsoft" | "salesforce" | "github" | null
```

Only URLs where `detectProvider` returns non-null get a `SmartLinkWrapper` injected. Unrecognised URLs skip the component entirely (no skeleton flash, no network call).

---

### `api.ts` (RTK Query)

```ts
// POST /api/v1/smart-links/resolve
resolveSmartLink: builder.query<SmartLinkResolution, string>({
  query: (url) => ({ url: '/api/v1/smart-links/resolve', method: 'POST', body: { url } }),
  keepUnusedDataFor: 300,  // 5 minutes — mirrors server cache TTL
})

// GET /api/v1/smart-links/providers
getSmartLinkProviders: builder.query<Provider[], void>({
  query: () => '/api/v1/smart-links/providers',
  keepUnusedDataFor: 60,
})
```

---

### `smartLinks.duck.ts`

Minimal RTK slice — the RTK Query cache handles most state. The slice stores:

- `connectedProviders: Record<string, boolean>` — populated from the `getSmartLinkProviders` response, used by `ConnectAccountPrompt` to show "already connecting" states.
- `userOptIn: boolean` — read from `metadata.userOptIn` in the `getSmartLinkProviders` response. All hooks and components check this before doing anything. Updated optimistically when the user toggles the preference.

---

## View Mode Integration

### `CardDescriptionTiptap.tsx` — view mode

The existing view-mode branch already runs a `useEffect` on the `previewContainerRef` DOM node to call `enrichExternalLinkChips` and hydrate proxy images. Extend this same `useEffect`:

1. After the existing `enrichExternalLinkChips` call, regex-scan `previewHtml` for all `href` values that match `detectProvider`.
2. Store the collected URLs in a `useState` (e.g. `detectedProviderUrls: string[]`).
3. Below the preview `<button>` element, render:
   ```tsx
   {detectedProviderUrls.map((url) => (
     <SmartLinkWrapper key={url} url={url} />
   ))}
   ```

The `dangerouslySetInnerHTML` content and the `enrichExternalLinkChips` call are left completely unchanged.

### `CommentItem.tsx` — view mode

The comment body is rendered via `dangerouslySetInnerHTML` using `renderContent()`. The existing `useEffect` on `commentMarkdownRef` runs `enrichExternalLinkChips`. Extend this `useEffect` the same way:

1. Scan the rendered `comment.content` string for provider URLs using `detectProvider`.
2. Store in `useState` (e.g. `commentProviderUrls: string[]`).
3. Below the `comment-markdown` div, render:
   ```tsx
   {commentProviderUrls.map((url) => (
     <SmartLinkWrapper key={url} url={url} />
   ))}
   ```

---

## Edit Mode Integration

### `CardDescriptionTiptap.tsx` — edit mode

In the existing `onUpdate` callback (where the editor content change is already observed and the draft is saved), also scan the Tiptap document text for provider URLs — debounced 600 ms. Store the last matched URL in a `useState` (e.g. `editPreviewUrl: string | null`).

Below the existing `InlineUploadPreview` block at the bottom of the edit-mode panel, render:

```tsx
{editPreviewUrl && <SmartLinkWrapper url={editPreviewUrl} />}
```

Dismiss `editPreviewUrl` when the editor content no longer contains that URL.

### `CommentEditor.tsx` — edit mode

Apply the same pattern in the existing `onUpdate` callback: debounced 600 ms scan of the editor text nodes using `detectProvider`. Store in `editPreviewUrl: string | null`. Render one `<SmartLinkWrapper>` below the existing `InlineUploadPreview` block.

---

## Accessibility

- `SmartLinkPreview` and `ConnectAccountPrompt` have `role="complementary"` and `aria-label` describing the link context.
- The `[↗]` icon button includes `aria-label="Open {title} in new tab"`.
- The "Connect [Service]" button includes `aria-label="Connect your {providerDisplayName} account to preview this link"`.
- Skeleton placeholders include `aria-busy="true"` and `aria-label="Loading link preview"`.
- Both components are keyboard-reachable (tab order follows the host link).

---

## Translations — `translations/en.json`

```json
{
  "smartLinks.connectHeading": "Connect your {{providerName}} account",
  "smartLinks.connectButton": "Connect your {{providerName}} account",
  "smartLinks.openInNewTab": "Open {{title}} in new tab",
  "smartLinks.loading": "Loading link preview",
  "smartLinks.badgeLabel": "{{linkType}}"
}
```

---

## Acceptance Criteria

- [ ] A Google Docs URL in a description/comment renders `SmartLinkPreview` (title, icon, "Google Doc" badge) when the user has connected Google
- [ ] The same URL renders `ConnectAccountPrompt` with button "Connect your Google Workspace account" when not connected
- [ ] A Slack channel URL renders `ConnectAccountPrompt` with button "Connect your Slack account" when not connected
- [ ] Clicking "Connect your [Platform] account" initiates the OAuth flow (navigates to `GET /api/v1/smart-links/connect/:provider`)
- [ ] After OAuth completes and the user returns to the card, the preview replaces the prompt automatically (RTK Query cache is invalidated on redirect return)
- [ ] A GitHub public repo URL resolves to `SmartLinkPreview` without any OAuth connection
- [ ] A GitHub private repo URL renders `ConnectAccountPrompt` with button "Connect your GitHub account"
- [ ] A URL that is **not** from a supported provider renders via the existing `enrichExternalLinkChips` pipeline — no `SmartLinkWrapper` rendered, no network call to `/resolve`
- [ ] `SMART_LINKS_ENABLED=false` means zero `SmartLinkWrapper` components render; all URLs follow the existing plain-link path
- [ ] A user with `smart_links_opt_in = false` sees plain links for all provider URLs — no preview, no connect prompt, no network call to `/resolve`
- [ ] The opt-in toggle in profile settings calls `PATCH /api/v1/smart-links/preference` and updates `userOptIn` in the Redux slice optimistically
- [ ] `SmartLinkWrapper` in view mode (description + comment) appears below the rendered content block, not replacing the `<a>` tag
- [ ] `SmartLinkWrapper` in edit mode (description editor + comment editor) appears below the `InlineUploadPreview` block while typing, dismissed when the URL is removed
- [ ] The same URL appearing in two comments makes only one `/resolve` call (RTK Query cache hit)
- [ ] The `[\u2197]` icon opens the URL in a new tab; clicking the preview card body does not navigate
- [ ] All copy is sourced from `translations/en.json` — no hardcoded strings
- [ ] Both `SmartLinkPreview` and `ConnectAccountPrompt` render correctly in dark mode
- [ ] Both components are keyboard-reachable with correct `aria-label` attributes

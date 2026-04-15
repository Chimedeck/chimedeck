# Sprint 136 — Webhooks: Register UI (`WebhooksRegisterPage`)

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 135 (Webhooks DB + API), Sprint 102 (API Token UI — establishes the settings page pattern used by `ApiTokenPage`)

---

## Goal

Add a **Webhooks** settings page (`WebhooksRegisterPage`) that mirrors the visual structure of `ApiTokenPage`. Users can register outgoing webhook endpoints, choose which event types they subscribe to, and see the one-time signing secret after creation. The page also includes an inline JavaScript code snippet showing how to verify the signature on the receiving server.

---

## Folder Structure

```
src/extensions/Webhooks/
├── translations/
│   └── en.json
├── webhooks.slice.ts                       # RTK Query API slice
└── containers/
    └── WebhooksRegisterPage/
        ├── WebhooksRegisterPage.tsx        # main page — lists webhooks + "Register" button
        ├── RegisterWebhookModal.tsx        # form: label, URL, event-type checkboxes
        ├── WebhookCreatedModal.tsx         # one-time signing secret reveal + copy
        ├── EditWebhookModal.tsx            # edit label/URL/event types/active toggle
        ├── DeleteWebhookDialog.tsx         # confirmation before delete
        └── SignatureVerificationSnippet.tsx # collapsible JS code guide
```

---

## Scope

### 1. RTK Query slice — `webhooks.slice.ts`

```ts
export const webhooksApi = createApi({
  reducerPath: 'webhooksApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1', credentials: 'include' }),
  tagTypes: ['Webhook'],
  endpoints: (builder) => ({
    listWebhooks: builder.query<WebhookItem[], string>({
      query: (workspaceId) => `/webhooks?workspaceId=${workspaceId}`,
      transformResponse: (res: { data: WebhookItem[] }) => res.data,
      providesTags: ['Webhook'],
    }),
    createWebhook: builder.mutation<CreateWebhookResponse, CreateWebhookBody>({
      query: (body) => ({ url: '/webhooks', method: 'POST', body }),
      invalidatesTags: ['Webhook'],
    }),
    updateWebhook: builder.mutation<{ data: WebhookItem }, { id: string } & UpdateWebhookBody>({
      query: ({ id, ...body }) => ({ url: `/webhooks/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Webhook'],
    }),
    deleteWebhook: builder.mutation<void, string>({
      query: (id) => ({ url: `/webhooks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Webhook'],
    }),
    listEventTypes: builder.query<string[], void>({
      query: () => '/webhooks/event-types',
      transformResponse: (res: { data: string[] }) => res.data,
    }),
  }),
});

export interface WebhookItem {
  id: string;
  label: string;
  endpointUrl: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateWebhookBody {
  workspaceId: string;
  label: string;
  endpointUrl: string;
  eventTypes: string[];
}

export interface UpdateWebhookBody {
  label?: string;
  endpointUrl?: string;
  eventTypes?: string[];
  isActive?: boolean;
}

export interface CreateWebhookResponse {
  data: WebhookItem & { signingSecret: string };
}
```

---

### 2. `WebhooksRegisterPage.tsx`

- Reads active `workspaceId` from Redux state (same pattern as board pages).
- Calls `useListWebhooksQuery(workspaceId)`.
- Displays a table:

| Column | Content |
|---|---|
| Name | `label` |
| Endpoint | `endpointUrl` (truncated to 48 chars) |
| Events | Comma-separated event type pills (max 3, then `+N more`) |
| Status | Green "Active" / Grey "Inactive" badge |
| Created | Formatted date |
| Actions | Edit icon · Delete icon |

- **"Register Endpoint"** button (top-right) opens `RegisterWebhookModal`.
- Below the table, always render `<SignatureVerificationSnippet />` in a collapsible section.
- Empty state: `"No webhooks registered yet. Register your first endpoint to start receiving events."`

---

### 3. `RegisterWebhookModal.tsx`

Fields:
1. **Label** — text input, required, max 100 chars
2. **Endpoint URL** — text input, required, client-side `https://` prefix validation
3. **Subscribe to events** — scrollable checklist of all event types from `useListEventTypesQuery()`; grouped visually:
   - *Card lifecycle*: `card.created`, `card.updated`, `card.deleted`, `card.archived`
   - *Card content*: `card.description_edited`, `card.attachment_added`, `card.commented`
   - *Card people*: `card.member_assigned`, `card.member_removed`
   - *Navigation*: `card.moved`
   - *Mentions*: `mention`
   - *Board*: `board.created`, `board.member_added`
   - "Select all" / "Clear all" toggle links at group headers
4. At least one event type must be checked (validate before submit).

On submit: calls `createWebhook`. On success: closes this modal and opens `WebhookCreatedModal` with the returned `signingSecret`.

---

### 4. `WebhookCreatedModal.tsx`

- Shows:
  - A green success banner: "Webhook registered successfully"
  - **Signing Secret** field (monospace, read-only) with copy-to-clipboard button
  - Warning callout: "This secret will not be shown again. Store it securely."
- After copying, button label changes to "Copied ✓" for 2 seconds.
- "Done" button dismisses.

---

### 5. `EditWebhookModal.tsx`

- Same form as `RegisterWebhookModal` but pre-populated.
- Extra toggle: **Active** / **Inactive** switch.
- On submit: calls `updateWebhook({ id, ...body })`.

---

### 6. `DeleteWebhookDialog.tsx`

- Confirmation text: `"Delete webhook '<label>'? All future events will stop being delivered to this endpoint."`
- "Delete" (destructive) + "Cancel" buttons.
- On confirm: calls `deleteWebhook(id)`.

---

### 7. `SignatureVerificationSnippet.tsx`

Collapsible panel (closed by default) titled **"How to verify webhook signatures"**.

Renders explanatory prose and the following JavaScript snippet in a syntax-highlighted `<pre>` block (use `highlight.js` or plain `<code className="language-js">`):

````tsx
const VERIFICATION_SNIPPET = `
const crypto = require('crypto');

/**
 * Verifies the Webhook-Signature header from an incoming webhook request.
 *
 * @param {string} signingSecret  - The signing secret issued when you registered the webhook.
 * @param {string} signatureHeader - Value of the 'Webhook-Signature' request header.
 * @param {string} rawBody        - The raw (unparsed) request body string.
 * @param {number} [toleranceSeconds=300] - Max age of the timestamp before rejection.
 * @returns {boolean}
 */
function verifyWebhookSignature(signingSecret, signatureHeader, rawBody, toleranceSeconds = 300) {
  // Step 1: extract timestamp and v0 signature from the header
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('='))
  );

  const timestamp = parts['t'];
  const receivedSig = parts['v0'];

  if (!timestamp || !receivedSig) {
    return false; // header malformed or scheme not v0 — reject
  }

  // Step 2: produce the signed payload string
  const signedPayload = \`\${timestamp}.\${rawBody}\`;

  // Step 3: compute HMAC-SHA256
  const expectedSig = crypto
    .createHmac('sha256', signingSecret)
    .update(signedPayload)
    .digest('hex');

  // Step 4: compare signatures using a timing-safe comparison
  const expected = Buffer.from(expectedSig, 'hex');
  const received = Buffer.from(receivedSig, 'hex');

  if (expected.length !== received.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(expected, received)) {
    return false;
  }

  // Optional: reject events older than the tolerance window
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  return age <= toleranceSeconds;
}

// Express.js example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const isValid = verifyWebhookSignature(
    process.env.WEBHOOK_SIGNING_SECRET,
    req.headers['webhook-signature'],
    req.body.toString()   // raw Buffer → string, before JSON.parse
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  console.log('Received event:', event.event, event.data);
  res.sendStatus(200);
});
`.trim();
````

Prose above the snippet:

> **Signature format**  
> Every webhook request includes the header:
> ```
> Webhook-Signature: t=<unix_timestamp>,v0=<hmac_sha256_hex>
> ```
> The `v0` value is an HMAC-SHA256 computed over `<timestamp>.<rawBody>` using your endpoint's signing secret as the key. To prevent downgrade attacks, **ignore all schemes other than `v0`**.
>
> **Replay protection** — reject events where the timestamp is older than 5 minutes.

---

### 8. Routing

Register the page under the existing user-settings routes (same pattern as `ApiTokenPage`):

```ts
// src/extensions/Webhooks/routes.ts
{
  path: '/settings/webhooks',
  element: <WebhooksRegisterPage />,
}
```

Add a **"Webhooks"** entry in the Settings sidebar nav group, below "API Tokens".

---

### 9. Translations — `translations/en.json`

```json
{
  "WebhooksPage.title": "Webhooks",
  "WebhooksPage.description": "Register external endpoints to receive real-time event notifications from your workspace.",
  "WebhooksPage.registerButton": "Register Endpoint",
  "WebhooksPage.emptyState": "No webhooks registered yet. Register your first endpoint to start receiving events.",
  "WebhooksPage.tableNameCol": "Name",
  "WebhooksPage.tableEndpointCol": "Endpoint",
  "WebhooksPage.tableEventsCol": "Events",
  "WebhooksPage.tableStatusCol": "Status",
  "WebhooksPage.tableCreatedCol": "Created",
  "WebhooksPage.statusActive": "Active",
  "WebhooksPage.statusInactive": "Inactive",

  "RegisterWebhookModal.title": "Register Webhook Endpoint",
  "RegisterWebhookModal.labelField": "Name",
  "RegisterWebhookModal.urlField": "Endpoint URL",
  "RegisterWebhookModal.eventsField": "Subscribe to events",
  "RegisterWebhookModal.selectAll": "Select all",
  "RegisterWebhookModal.clearAll": "Clear all",
  "RegisterWebhookModal.urlError": "Endpoint URL must start with https://",
  "RegisterWebhookModal.eventsError": "Select at least one event type",
  "RegisterWebhookModal.submit": "Register",
  "RegisterWebhookModal.cancel": "Cancel",

  "WebhookCreatedModal.title": "Webhook Registered",
  "WebhookCreatedModal.successBanner": "Webhook registered successfully",
  "WebhookCreatedModal.secretLabel": "Signing Secret",
  "WebhookCreatedModal.secretWarning": "This secret will not be shown again. Store it securely.",
  "WebhookCreatedModal.copyButton": "Copy",
  "WebhookCreatedModal.copiedButton": "Copied ✓",
  "WebhookCreatedModal.done": "Done",

  "EditWebhookModal.title": "Edit Webhook",
  "EditWebhookModal.activeLabel": "Active",
  "EditWebhookModal.submit": "Save changes",

  "DeleteWebhookDialog.title": "Delete Webhook",
  "DeleteWebhookDialog.confirm": "Delete",
  "DeleteWebhookDialog.cancel": "Cancel",

  "SignatureSnippet.title": "How to verify webhook signatures",
  "SignatureSnippet.expand": "Show instructions",
  "SignatureSnippet.collapse": "Hide instructions"
}
```

---

## Acceptance Criteria

- [ ] `/settings/webhooks` route renders `WebhooksRegisterPage`
- [ ] Page lists webhooks in a table; empty state shown when none exist
- [ ] "Register Endpoint" opens `RegisterWebhookModal` with event-type checklist
- [ ] "Select all" / "Clear all" per group work
- [ ] Client validates `https://` prefix before submitting
- [ ] At least one event type required (error shown otherwise)
- [ ] After registration, `WebhookCreatedModal` shows the `signingSecret` once with copy button
- [ ] Copy button label changes to "Copied ✓" then resets after 2 s
- [ ] Signing secret is absent from the list table
- [ ] Edit modal pre-fills all fields; active toggle works
- [ ] Delete dialog shows webhook label; calls `deleteWebhook` on confirm
- [ ] `SignatureVerificationSnippet` renders collapsed by default, expands on click
- [ ] Snippet contains correct `verifyWebhookSignature` implementation using `crypto.timingSafeEqual`
- [ ] Settings sidebar shows "Webhooks" below "API Tokens"
- [ ] All text comes from `translations/en.json`

---

## Tests

| File | Coverage |
|---|---|
| `tests/unit/webhooks/SignatureVerificationSnippet.test.tsx` | Renders collapsed; expands on button click |
| `tests/unit/webhooks/RegisterWebhookModal.test.tsx` | URL validation; empty event-types error; select-all |
| `tests/integration/webhooks/ui-crud.test.ts` | Register → list → edit → delete via mocked API |

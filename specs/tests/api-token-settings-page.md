# Playwright MCP Test Spec — API Token Settings Page (Sprint 102, Iteration 6)

> Tests that the /settings/api-tokens route is registered, "API Tokens" link appears in the
> user menu, and the ApiTokenPage renders correctly.

---

## Setup

- Dev server running at `http://localhost:5173`
- Backend running at `http://localhost:3000`
- Seeded user: `user-a@test.com` / `password`

---

## Scenario 1 — "API Tokens" link is visible in the user menu

**Given** user is logged in as `user-a@test.com`
**When** user opens the user avatar / account menu in the sidebar
**Then**
- A nav link with text "API Tokens" is visible in the dropdown menu

---

## Scenario 2 — Clicking "API Tokens" navigates to /settings/api-tokens

**Given** user is logged in and the user menu is open
**When** user clicks "API Tokens"
**Then**
- Browser URL changes to `/settings/api-tokens`
- Page heading "API Tokens" is visible
- Description text "Tokens allow external tools and scripts to authenticate as you." is visible
- "Generate new token" button is visible

---

## Scenario 3 — Empty state renders when no tokens exist

**Given** user has no API tokens
**When** user is on `/settings/api-tokens`
**Then**
- "No API tokens yet." text is displayed

---

## Scenario 4 — Generate new token flow

**Given** user is on `/settings/api-tokens`
**When** user clicks "Generate new token"
**Then** GenerateTokenModal opens with:
  - "Generate new token" heading
  - Token name input field with placeholder "e.g. CI pipeline, local dev"
  - "No expiry" checkbox checked by default
  - "Generate token" button
  - "Cancel" button

**When** user types "My CI Token" in the name field and clicks "Generate token"
**Then**
- GenerateTokenModal closes
- TokenCreatedModal opens with:
  - "Your new token" heading
  - Warning text "This token will not be shown again. Copy it now."
  - A read-only monospace input containing a value starting with `hf_`
  - "Copy" button
  - "Done" button

---

## Scenario 5 — Copy token to clipboard

**Given** TokenCreatedModal is open with a raw token
**When** user clicks "Copy"
**Then**
- Button text changes to "Copied!"
- Clipboard contains the `hf_...` token value

---

## Scenario 6 — Token appears in list after dismissing modal

**Given** TokenCreatedModal is open
**When** user clicks "Done"
**Then**
- Modal closes
- Token table renders with one row
- Row shows the token name "My CI Token"
- Row shows a token prefix (e.g. `hf_3a7b…`)
- "Revoke" button is visible on the row

---

## Scenario 7 — Revoke token with confirmation

**Given** a token row is visible in the list
**When** user clicks "Revoke" on the token row
**Then** RevokeTokenDialog opens with:
  - "Revoke token?" heading
  - Body text mentioning "My CI Token"
  - "Revoke" confirm button
  - "Cancel" button

**When** user clicks "Revoke"
**Then**
- Dialog closes
- Token row is removed from the list
- "No API tokens yet." empty state is shown again

---

## Scenario 8 — Cancel revoke keeps token in list

**Given** RevokeTokenDialog is open
**When** user clicks "Cancel"
**Then**
- Dialog closes
- Token row remains in the list

---

## Scenario 9 — Direct navigation to /settings/api-tokens

**Given** user is logged in
**When** user navigates directly to `http://localhost:5173/settings/api-tokens`
**Then**
- Page loads with "API Tokens" heading (no redirect, no 404)

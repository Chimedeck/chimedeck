> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 92 — Iteration 5: Plugins i18n

## Goal
Verify that all Plugins UI copy is served from `src/extensions/Plugins/translations/en.json` and that all key user flows (dashboard, search, register/edit modals, board panel, domain allowlist) display correct text.

---

## Setup

1. Navigate to the application and log in as a platform admin user.
2. Open any board.

---

## Test 1 — Plugins Dashboard title and header

### Steps
1. Navigate to `/boards/:boardId/settings/plugins`.

### Expected results
- The page heading reads **"Plugins"**.
- A **"← Back to board"** button is visible.
- A **"+ Register Plugin"** button is visible (platform admin only).

---

## Test 2 — Plugins search bar placeholder and category dropdown

### Steps
1. On the Plugins dashboard page, locate the search bar.

### Expected results
- The search input has placeholder text **"Search plugins…"**.
- The category dropdown default option reads **"All categories"**.

---

## Test 3 — Plugin list section headings and empty states

### Steps
1. On the Plugins dashboard page with no plugins enabled on the board.

### Expected results
- A section heading **"Active on this board"** is visible.
- The empty state text reads **"No plugins enabled on this board yet."**
- A section heading **"Available plugins"** is visible.
- If no plugins are available, the text reads **"No additional plugins available."**

---

## Test 4 — No-match search empty state

### Steps
1. Type a query that returns no plugins in the search bar.

### Expected results
- The text **"No plugins match your search."** is displayed.
- A **"Clear search"** link is visible.

---

## Test 5 — Plugin card Enable/Disable buttons

### Steps
1. Find a plugin in the **"Available plugins"** list.
2. Observe the action button.

### Expected results
- The button reads **"Enable"**.
- While enabling, the button reads **"Enabling…"**.

### Steps (disable)
1. Find a plugin in the **"Active on this board"** list.
2. Observe the action button.

### Expected results
- The button reads **"Disable"**.
- While disabling, the button reads **"Disabling…"**.

---

## Test 6 — Plugin card edit and settings aria-labels

### Steps
1. As a platform admin, observe a plugin card.

### Expected results
- The edit (pencil) button has `aria-label="Edit plugin"` and `title="Edit plugin"`.
- The settings (gear) button on an active plugin has `aria-label="Open plugin settings"` and `title="Plugin settings"`.

---

## Test 7 — Register Plugin modal

### Steps
1. Click **"+ Register Plugin"**.

### Expected results
- A modal titled **"Register a Plugin"** opens.
- The close button has `aria-label="Close"`.
- Form fields are visible: **Plugin Name**, **Slug**, **Description**, **Connector URL**, **Manifest URL**, **Icon URL**, **Author**, **Author Email**, **Support Email**, **Categories**.
- Placeholders match: `My Awesome Plugin`, `my-awesome-plugin`, `What does this plugin do?`, `https://my-plugin.example.com/connector`, etc.
- A checkbox labelled **"Public (visible to all users)"** is visible.
- The submit button reads **"Register Plugin"**.
- The cancel button reads **"Cancel"**.

### Steps (submitting)
1. Click the submit button while the form is submitting.

### Expected results
- The submit button reads **"Registering…"** during submission.

---

## Test 8 — Register Plugin modal validation errors

### Steps
1. Open the Register Plugin modal.
2. Click **"Register Plugin"** without filling in any fields.

### Expected results
- Error messages appear:
  - **"Name is required."**
  - **"Slug is required."**
  - **"Description is required."**
  - **"Connector URL is required."**
  - **"Author name is required."**

### Steps (invalid slug)
1. Enter an invalid slug (e.g., "My Slug!").

### Expected results
- **"Slug must be lowercase letters, numbers, and hyphens only."** appears.

### Steps (invalid connector URL)
1. Enter a connector URL without `https://`.

### Expected results
- **"Connector URL must start with https://"** appears.

### Steps (server error - slug taken)
1. Submit a plugin whose slug is already taken.

### Expected results
- **"This slug is already taken. Please choose a different slug."** appears.

---

## Test 9 — Edit Plugin modal

### Steps
1. As a platform admin, click the edit (pencil) button on a plugin card.

### Expected results
- A modal titled **"Edit Plugin"** opens.
- The close button has `aria-label="Close"`.
- Form fields are visible: **Plugin Name**, **Description**, **Connector URL**, **Manifest URL**, **Icon URL**, **Author**, **Author Email**, **Support Email**, **Categories**, **Whitelisted Domains**.
- The **Whitelisted Domains** hint reads **"External domains this plugin may load (https:// only, max 20)."**
- The whitelisted domains placeholder reads **"https://api.example.com — press Enter to add"**.
- A checkbox labelled **"Public (visible to all users)"** is visible.
- The submit button reads **"Save Changes"**.
- The cancel button reads **"Cancel"**.

### Steps (submitting)
1. Click the submit button while the form is submitting.

### Expected results
- The submit button reads **"Saving…"** during submission.

### Steps (server error - too many domains)
1. Trigger the `too-many-whitelisted-domains` server error.

### Expected results
- **"Too many whitelisted domains (max 20)."** appears.

---

## Test 10 — API Key Reveal modal

### Steps
1. Successfully register a new plugin.

### Expected results
- A modal titled **"Plugin API Key"** opens.
- A warning reads **"This API key will never be shown again. Copy it now and store it securely."**
- The copy button reads **"Copy"** and has `aria-label="Copy API key"`.
- After clicking copy, the button reads **"✓ Copied"**.
- A dismiss button reads **"I've saved the key — Done"**.

---

## Test 11 — Allowed Domains panel

### Steps
1. Open the settings for an active plugin that has `whitelistedDomains`.
2. The settings modal opens with the domain panel visible at the bottom.

### Expected results
- A heading **"Allowed Domains"** is visible.
- The description reads **"Restrict which external domains this plugin may open on this board. Unchecked domains will be blocked."**
- The save button reads **"Save domain settings"**.

### Steps (saving)
1. Toggle a domain checkbox and click **"Save domain settings"**.

### Expected results
- The button reads **"Saving…"** during the save operation.
- On success, a status message **"Domain settings saved."** appears.

---

## Test 12 — Plugin capability chips labels

### Steps
1. Find a plugin card with capabilities displayed.

### Expected results
- `card-badges` capability shows chip **"Card Badges"**.
- `card-buttons` capability shows chip **"Card Buttons"**.
- `card-detail-badges` capability shows chip **"Card Detail Badges"**.
- `section` capability shows chip **"Section"**.
- `show-settings` capability shows chip **"Settings"**.
- `authorization-status` capability shows chip **"Auth Status"**.
- `show-authorization` capability shows chip **"Authorization"**.

---

## Test 13 — Plugin modal (iframe overlay)

### Steps
1. Click the settings gear on an active plugin to open the plugin settings modal.

### Expected results
- The close button has `aria-label="Close modal"`.
- When no title is set, the modal heading defaults to **"Plugin"**.

---

## Test 14 — Plugin popup

### Steps
1. Trigger a popup via a plugin button (e.g., via `t.popup()`).

### Expected results
- The popup close button has `aria-label="Close popup"`.
- When no title is set, the popup heading defaults to **"Plugin"**.
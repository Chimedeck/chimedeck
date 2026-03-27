> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 92 — Iteration 7: Plugins — Edit modal, Board panel, Domain allowlist

## Goal
Verify that Plugins edit modal (`EditPluginModal`), board plugins panel (`PluginList`),
domain allowlist panel (`PluginAllowedDomainsPanel`), and API key reveal modal
(`ApiKeyRevealModal`) all display copy sourced from
`src/extensions/Plugins/translations/en.json`. No hard-coded strings should remain.

---

## Setup

1. Log in as a platform admin user.
2. Navigate to any board.

---

## Test 1 — Edit Plugin modal titles and buttons

### Steps
1. Navigate to `/boards/:boardId/settings/plugins`.
2. As a platform admin, click the pencil (edit) icon on any plugin card.

### Expected results
- A modal with the heading **"Edit Plugin"** opens.
- The close button has `aria-label="Close"`.
- The cancel button reads **"Cancel"**.
- The submit button reads **"Save Changes"**.
- While the form is submitting, the submit button reads **"Saving…"**.

---

## Test 2 — Edit Plugin modal field labels and placeholders

### Steps
1. Open the Edit Plugin modal.

### Expected results
- Field labels visible: **Plugin Name**, **Description**, **Connector URL**, **Manifest URL**, **Icon URL**, **Author**, **Author Email**, **Support Email**, **Categories**, **Whitelisted Domains**.
- `Plugin Name` input has placeholder **"My Awesome Plugin"**.
- `Description` textarea has placeholder **"What does this plugin do?"**.
- `Connector URL` input has placeholder **"https://my-plugin.example.com/connector"**.
- `Whitelisted Domains` section has hint **"External domains this plugin may load (https:// only, max 20)."**.
- `Whitelisted Domains` input has placeholder **"https://api.example.com — press Enter to add"**.
- A checkbox labelled **"Public (visible to all users)"** is visible.

---

## Test 3 — Edit Plugin modal validation errors

### Steps
1. Open the Edit Plugin modal and submit without filling required fields.

### Expected results
- **"Name is required."** appears below the Plugin Name field.
- **"Description is required."** appears below the Description field.
- **"Connector URL is required."** appears below the Connector URL field.
- **"Author name is required."** appears below the Author field.

### Steps (invalid formats)
1. Enter a connector URL without `https://`.

### Expected results
- **"Connector URL must start with https://"** appears.

### Steps (invalid email)
1. Enter a malformed author email.

### Expected results
- **"Invalid email address."** appears.

### Steps (invalid domain)
1. Add a whitelisted domain without `https://`.

### Expected results
- **"All domains must start with https://"** appears.

---

## Test 4 — Edit Plugin modal server errors

### Steps
1. Trigger server error `invalid-connector-url`.

### Expected results
- **"The connector URL is invalid. It must start with https://."** appears.

### Steps (domain error)
1. Trigger server error `invalid-whitelisted-domain`.

### Expected results
- **"One or more domains are invalid. They must start with https://."** appears.

### Steps (too many domains)
1. Trigger server error `too-many-whitelisted-domains`.

### Expected results
- **"Too many whitelisted domains (max 20)."** appears.

---

## Test 5 — Board plugins panel section headings and empty states

### Steps
1. Open the Plugins settings page for a board with no plugins enabled.

### Expected results
- A section heading **"Active on this board"** is visible.
- The empty state reads **"No plugins enabled on this board yet."**.
- A section heading **"Available plugins"** is visible.

### Steps (no available plugins)
1. View the page when no additional plugins are available.

### Expected results
- The empty state reads **"No additional plugins available."**.

---

## Test 6 — Board plugin card Enable / Disable buttons

### Steps
1. Find a plugin in the **"Available plugins"** section.

### Expected results
- The action button reads **"Enable"**.
- While enabling, the button reads **"Enabling…"**.

### Steps (disable)
1. Find a plugin in the **"Active on this board"** section.

### Expected results
- The action button reads **"Disable"**.
- While disabling, the button reads **"Disabling…"**.

---

## Test 7 — Allowed Domains panel

### Steps
1. Open the settings modal for an active plugin that declares `whitelistedDomains`.
2. Scroll to the domain panel at the bottom of the modal.

### Expected results
- A heading **"Allowed Domains"** is visible.
- The description reads **"Restrict which external domains this plugin may open on this board. Unchecked domains will be blocked."**.
- The save button reads **"Save domain settings"** and is disabled while unchanged (pristine).

### Steps (saving)
1. Toggle a domain checkbox and click **"Save domain settings"**.

### Expected results
- The button reads **"Saving…"** during the save request.
- On success, a status message **"Domain settings saved."** appears.

### Steps (save failure)
1. Simulate a network error during save.

### Expected results
- An error message **"Failed to save domain settings."** appears.

---

## Test 8 — API Key Reveal modal

### Steps
1. Successfully register a new plugin.

### Expected results
- A modal titled **"Plugin API Key"** opens with `aria-label="API Key"`.
- The warning section shows **"⚠️"** prefix followed by **"This API key will never be shown again. Copy it now and store it securely."**.
- The copy button reads **"Copy"** with `aria-label="Copy API key"`.
- After clicking copy, the button reads **"✓ Copied"**.
- The dismiss button reads **"I've saved the key — Done"**.
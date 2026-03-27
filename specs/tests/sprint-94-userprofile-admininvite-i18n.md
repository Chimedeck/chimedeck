> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 94 — UserProfile + AdminInvite i18n Test Plan (Playwright MCP)

## Overview

Verify that all UI copy in the UserProfile and AdminInvite extensions renders from translation keys, with zero hardcoded English strings remaining.

---

## Prerequisites

- Dev server running at `http://localhost:3000`
- Logged in as an admin user
- At least one board exists

---

## Test Suite 1: UserProfile — Profile Settings Page

### 1.1 Navigate to Profile Settings

1. Open `http://localhost:3000`
2. Click the current user avatar / profile icon in the sidebar or top bar
3. Click "Edit profile info" in the member popover
4. Assert: URL changes to `/profile` or similar profile settings route

### 1.2 Verify page title and back button

- Assert: `<h1>` text equals `"Profile Settings"` (from `UserProfile.pageTitle`)
- Assert: Back button text equals `"← Back"` (from `UserProfile.backButton`)

### 1.3 Verify signed-in-as label

- Assert: The `<p>` with `uppercase tracking-wide` styling reads `"Signed in as"` (from `UserProfile.signedInAs`)
- Assert: The email address of the logged-in user is displayed below it

### 1.4 Verify Notification Preferences heading (if enabled)

- If the Notification Preferences section is rendered:
  - Assert: `<h2>` reads `"Notification Preferences"` (from `UserProfile.notificationPreferences`)

### 1.5 No hardcoded strings

- Run: `grep -r "Profile Settings\|Signed in as\|Notification Preferences\|← Back" src/extensions/UserProfile/ --include="*.tsx"`
- Assert: Zero matches

---

## Test Suite 2: AdminInvite — Invite External User Modal

### 2.1 Open the modal

1. Navigate to a board
2. In the sidebar, click the "Invite External User" button (admin only)
3. Assert: Modal opens with overlay

### 2.2 Verify modal title and description

- Assert: `<Dialog.Title>` text equals `"Invite External User"` (from `AdminInvite.modalTitle`)
- Assert: Description paragraph equals `"Create an account for someone outside your organisation."` (from `AdminInvite.modalDescription`)

### 2.3 Verify close button aria-label

- Assert: Close button has `aria-label="Close"` (from `AdminInvite.closeButton`)

### 2.4 Verify email field

- Assert: `<label for="invite-email">` reads `"Email address"` (from `AdminInvite.emailLabel`)
- Assert: Input `placeholder` equals `"contractor@example.com"` (from `AdminInvite.emailPlaceholder`)

### 2.5 Verify display name field

- Assert: `<label for="invite-display-name">` reads `"Display name"` (from `AdminInvite.displayNameLabel`)
- Assert: Input `placeholder` equals `"Jane Smith"` (from `AdminInvite.displayNamePlaceholder`)

### 2.6 Verify password mode radio group

- Assert: `<legend>` reads `"Password"` (from `AdminInvite.passwordModeLabel`)
- Assert: First radio label reads `"Generate automatically"` (from `AdminInvite.passwordModeAuto`)
- Assert: Second radio label reads `"Set manually"` (from `AdminInvite.passwordModeManual`)

### 2.7 Verify manual password input

1. Click the "Set manually" radio
2. Assert: Password label reads `"Password"` (from `AdminInvite.passwordLabel`)
3. Type a weak password (e.g. `"abc"`)
4. Assert: Strength label shows `"Very weak"` → `"Weak"` → `"Fair"` → `"Strong"` as password grows

### 2.8 Verify action buttons

- Assert: Cancel button reads `"Cancel"` (from `AdminInvite.cancelButton`)
- Assert: Submit button reads `"Create account"` (from `AdminInvite.submitButton`)

### 2.9 Verify validation error messages

1. Click "Create account" with empty fields
2. Assert: Email error reads `"Please enter a valid email address."` (from `AdminInvite.errorInvalidEmail`)
3. Assert: Display name error reads `"Display name is required."` (from `AdminInvite.errorDisplayNameRequired`)
4. Fill a valid email, select "Set manually", enter a weak password, submit
5. Assert: Password error reads `"Password must be at least 8 characters with a letter and a number."` (from `AdminInvite.errorPasswordTooWeak`)

### 2.10 Verify toggles (conditional)

- If `showEmailToggle` is enabled:
  - Assert: Checkbox label reads `"Send login credentials to the user by email"` (from `AdminInvite.sendEmailToggle`)
- If `emailVerificationEnabled` is enabled:
  - Assert: Checkbox label reads `"Mark email as verified"` (from `AdminInvite.autoVerifyToggle`)

---

## Test Suite 3: AdminInvite — Credential Sheet

### 3.1 Successfully create a user

1. Fill the modal with a valid email, display name, and strong password
2. Click "Create account"
3. Assert: Modal switches to credential sheet view

### 3.2 Verify credential sheet title

- Assert: `<h3>` reads `"New account created"` (from `AdminInvite.credentialSheetTitle`)

### 3.3 Verify credential field labels

- Assert: Credential block contains label `"Email:"` (from `AdminInvite.credentialFieldEmail`)
- Assert: Credential block contains label `"Password:"` (from `AdminInvite.credentialFieldPassword`)
- Assert: Credential block contains label `"Login URL:"` (from `AdminInvite.credentialFieldLoginUrl`)

### 3.4 Verify copy button

- Assert: Copy button `aria-label` equals `"Copy credentials to clipboard"` (from `AdminInvite.copyAriaLabel`)
- Assert: Button text reads `"Copy to clipboard"` (from `AdminInvite.copyButton`)
- Click the button
- Assert: Button text changes to `"Copied!"` (from `AdminInvite.copiedStatus`)

### 3.5 Verify Done button

- Assert: Done button reads `"Done"` (from `AdminInvite.doneButton`)
- Click "Done"
- Assert: Modal closes

---

## Test Suite 4: No Hardcoded Strings Verification

Run the following shell assertions to confirm zero hardcoded English strings remain:

```bash
# UserProfile
grep -r "Profile Settings\|Signed in as\|Notification Preferences\|← Back" \
  src/extensions/UserProfile/ --include="*.tsx"
# Expect: no output

# AdminInvite
grep -r '"Invite External User"\|"Email address"\|"Display name"\|"Generate automatically"\|"Set manually"\|"Create account"\|"Cancel"\|"Copy to clipboard"\|"Copied!"\|"Done"\|"Email verified"\|"Email not verified"\|"New account created"' \
  src/extensions/AdminInvite/ --include="*.tsx"
# Expect: no output
```
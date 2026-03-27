> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test Spec: Email Notifications (SES)

> Playwright MCP specification for Sprint 72 — Email Notifications via SES.

---

## Setup

- Base URL: `http://localhost:5173`
- Two test users pre-seeded: `user-a@test.com` / `user-b@test.com` (password `password`)
- SES is mocked in test mode (no real AWS calls; captured emails are readable from test fixture)
- Server flags `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true` unless stated otherwise
- User B's `notification_preferences` row for type `mention` has `email_enabled=true` unless stated

---

## Scenario 1 — Mention triggers email to mentioned user

**Given** `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** user B has `email_enabled=true` for type `mention`
**And** user A is logged in as `user-a@test.com`
**And** a board exists with both user A and user B as members

**When** user A opens a card and adds a comment containing `@user-b`
**And** user A submits the comment

**Then**
- The comment is submitted successfully (201)
- An email is dispatched to `user-b@test.com`
- Email subject contains "mentioned you"
- Email body contains a link to the card (`/boards/{boardId}/cards/{cardId}`)
- Email body contains a link to notification preferences (`/settings/profile#notifications`)
- Email has a plain-text fallback body

---

## Scenario 2 — No mention email when user's email preference is disabled

**Given** `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** user B has `email_enabled=false` for type `mention` in `notification_preferences`
**And** user A is logged in

**When** user A posts a comment mentioning `@user-b`

**Then**
- The comment is created successfully
- No email is dispatched to `user-b@test.com`

---

## Scenario 3 — Card created triggers email to all board members (excluding actor)

**Given** `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** a board has user A and user B as members
**And** user A is logged in

**When** user A creates a new card in the board

**Then**
- The card is created successfully
- An email is dispatched to `user-b@test.com`
- Email subject contains the card title
- Email body contains the list name where the card was created
- Email body contains a link to the card
- No email is dispatched to `user-a@test.com` (actor is excluded)

---

## Scenario 4 — Card moved triggers email to all board members (excluding actor)

**Given** `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** a board has user A and user B as members and at least two lists
**And** user A is logged in

**When** user A moves a card from list "To Do" to list "In Progress"

**Then**
- The card move is saved successfully
- An email is dispatched to `user-b@test.com`
- Email subject mentions the card title
- Email body mentions both "To Do" and "In Progress"
- No email is dispatched to `user-a@test.com` (actor excluded)

---

## Scenario 5 — Comment on card triggers email to all board members (excluding actor)

**Given** `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** a board has user A and user B as members
**And** user A is logged in

**When** user A posts a comment on a card (no @mention)

**Then**
- The comment is created successfully
- An email is dispatched to `user-b@test.com`
- Email subject contains the card title
- Email body contains a short preview of the comment
- No email is dispatched to `user-a@test.com` (actor excluded)

---

## Scenario 6 — No emails when SES_ENABLED=false

**Given** `SES_ENABLED=false` (master SES flag is off)
**And** `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** all user preferences have `email_enabled=true`

**When** user A creates a card or posts a comment mentioning user B

**Then**
- The action completes successfully with no error
- No email is dispatched to any user

---

## Scenario 7 — No emails when EMAIL_NOTIFICATIONS_ENABLED=false

**Given** `SES_ENABLED=true`
**And** `EMAIL_NOTIFICATIONS_ENABLED=false`
**And** all user preferences have `email_enabled=true`

**When** user A creates a card

**Then**
- The card is created successfully
- No email is dispatched

---

## Scenario 8 — SES failure does not break the mutation

**Given** `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** SES mock is configured to throw an error on send

**When** user A creates a card

**Then**
- The card is created successfully (201 response)
- A warning is logged by the server (visible in server logs)
- No error is returned to the client
- The card creation response contains the created card data

---

## Scenario 9 — Board member with card_created email disabled receives no email

**Given** `SES_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true`
**And** user B has `email_enabled=false` for type `card_created` in `notification_preferences`
**And** user C has `email_enabled=true` for type `card_created`

**When** user A creates a card on a board where A, B, C are all members

**Then**
- Card is created successfully
- An email is dispatched to `user-c@test.com`
- No email is dispatched to `user-b@test.com`
- No email is dispatched to `user-a@test.com` (actor excluded)
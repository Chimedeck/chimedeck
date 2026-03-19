# Sprint 72 — Email Notifications for Mentions & Board Activity

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 70 (Notification Preferences DB + API), Sprint 23 (Email / SES), Sprint 26 (Mention Notifications)

---

## Goal

Deliver outbound email notifications via AWS SES for all four notification types: `mention`, `card_created`, `card_moved`, and `card_commented`. Email dispatch is:

1. Gated by the user's notification preferences (`email_enabled` for each type — Sprint 70)
2. Gated by server feature flags (`SES_ENABLED`, `EMAIL_NOTIFICATIONS_ENABLED`)
3. Triggered by the same events that produce in-app notifications

Each email is a minimal transactional template (plain HTML, no marketing chrome) rendered server-side and dispatched through the existing SES module from Sprint 23.

---

## Feature Flags

| Flag | Default | Controls |
|---|---|---|
| `SES_ENABLED` | `false` | Master switch for all outgoing SES email (defined in Sprint 23) |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | Enable notification emails specifically. Both flags must be `true` for emails to send |

```
email dispatched = SES_ENABLED === true
               && EMAIL_NOTIFICATIONS_ENABLED === true
               && user.notification_preferences[type].email_enabled === true
```

---

## Scope

### 1. `server/config/env.ts` — update

```ts
EMAIL_NOTIFICATIONS_ENABLED: Bun.env['EMAIL_NOTIFICATIONS_ENABLED'] === 'true',
```

---

### 2. Email Template Module

**`server/extensions/notifications/mods/emailTemplates/`**

```
emailTemplates/
  mention.ts        # "@{actorName} mentioned you in {cardTitle}"
  cardCreated.ts    # "New card "{cardTitle}" was created in {boardName}"
  cardMoved.ts      # "Card "{cardTitle}" was moved to "{listName}"
  cardCommented.ts  # "{actorName} commented on "{cardTitle}""
  shared.ts         # base HTML wrapper (header, footer, unsubscribe note)
```

Each template is a function:

```ts
interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string; // plain-text fallback
}

function renderMentionEmail({ actorName, cardTitle, boardName, cardUrl }): EmailTemplateOutput
function renderCardCreatedEmail({ cardTitle, boardName, listName, cardUrl }): EmailTemplateOutput
function renderCardMovedEmail({ cardTitle, fromList, toList, boardName, cardUrl }): EmailTemplateOutput
function renderCardCommentedEmail({ actorName, cardTitle, boardName, commentPreview, cardUrl }): EmailTemplateOutput
```

All emails include:
- A direct link to the card (`cardUrl`: `/boards/{boardId}/cards/{cardId}`)
- A brief one-line footer: _"You received this because you are a member of {boardName}. [Manage notification preferences]"_ (the link points to `/settings/profile#notifications`)

---

### 3. Email Dispatch Helper

**`server/extensions/notifications/mods/emailDispatch.ts`**

```ts
async function dispatchNotificationEmail({
  recipientId,
  type,
  templateData,
}: {
  recipientId: string;
  type: NotificationType;
  templateData: Record<string, string>;
}): Promise<void>
```

Responsibilities:
1. Fetch the recipient's email address from the `users` table.
2. Check `EMAIL_NOTIFICATIONS_ENABLED` and `SES_ENABLED` flags — return early if either is off.
3. Fetch the user's preference via `preferenceGuard.getPreference()` (Sprint 70) — return early if `email_enabled` is `false` for this type.
4. Render the appropriate template.
5. Call the existing `server/extensions/auth/mods/ses/sendEmail.ts` (from Sprint 23).
6. Log a warning on failure — **never** throw (email failure must not block the mutation path).

---

### 4. Hook Into Dispatch Points

#### 4a. Mention emails (extend Sprint 26 hook)

In `server/extensions/notifications/mods/dispatch.ts` (the mention creation hook):

```ts
// After in-app notification creation:
await dispatchNotificationEmail({
  recipientId: mentionedUserId,
  type: 'mention',
  templateData: { actorName, cardTitle, boardName, cardUrl },
});
```

#### 4b. Board activity emails (new hooks, shared with Sprint 73)

Create **`server/extensions/notifications/mods/boardActivityDispatch.ts`**:

Hook into the events pipeline (after `events/dispatch.ts` persists to DB) for:

| Event type | Notification type | Recipients |
|---|---|---|
| `card.created` | `card_created` | All board members except the actor |
| `card.moved` | `card_moved` | All board members except the actor |
| `comment.created` | `card_commented` | All board members except the actor |

```ts
// Called from events/dispatch.ts after event is persisted
async function handleBoardActivityNotification({
  event,
  boardId,
  actorId,
}: {
  event: Event;
  boardId: string;
  actorId: string;
}): Promise<void>
```

Fetches board member IDs (excluding `actorId`), then for each:
- Calls `dispatchNotificationEmail(...)` — gated by preferences
- Feeds into Sprint 73's in-app dispatch (same entry point, two independent channels)

---

### 5. Integration Tests

**`tests/integration/notifications/emailNotifications.test.ts`**

| Scenario | Expected |
|---|---|
| `mention` event, user has `email_enabled: true`, both flags on | Email dispatched via SES mock |
| `mention` event, user has `email_enabled: false` | No email dispatched |
| `card_created` event, both flags on, member has email on | Email dispatched to all board members |
| `SES_ENABLED=false` | No email dispatched regardless of preferences |
| `EMAIL_NOTIFICATIONS_ENABLED=false` | No email dispatched regardless of preferences |
| SES throws | Warning logged, no exception propagated, mutation succeeds |

---

## Files

| Path | Change |
|---|---|
| `server/config/env.ts` | Add `EMAIL_NOTIFICATIONS_ENABLED` |
| `server/mods/flags/providers/defaults.ts` | Add `EMAIL_NOTIFICATIONS_ENABLED: false` |
| `server/extensions/notifications/mods/emailTemplates/mention.ts` | New |
| `server/extensions/notifications/mods/emailTemplates/cardCreated.ts` | New |
| `server/extensions/notifications/mods/emailTemplates/cardMoved.ts` | New |
| `server/extensions/notifications/mods/emailTemplates/cardCommented.ts` | New |
| `server/extensions/notifications/mods/emailTemplates/shared.ts` | New — base HTML wrapper |
| `server/extensions/notifications/mods/emailDispatch.ts` | New — gated dispatch helper |
| `server/extensions/notifications/mods/boardActivityDispatch.ts` | New — hooks for card events |
| `server/extensions/events/dispatch.ts` | Call `handleBoardActivityNotification` after event persist |
| `server/extensions/notifications/mods/dispatch.ts` | Call `dispatchNotificationEmail` after mention in-app creation |
| `tests/integration/notifications/emailNotifications.test.ts` | New |

---

## Acceptance Criteria

- [ ] Mention email is sent when both flags on and user's email preference is enabled
- [ ] `card_created`, `card_moved`, `card_commented` emails sent to all board members (excluding actor) when enabled
- [ ] Email is NOT sent when `SES_ENABLED=false` or `EMAIL_NOTIFICATIONS_ENABLED=false`
- [ ] Email is NOT sent when user's `email_enabled` is `false` for the type
- [ ] SES failure is fire-and-forget — does not block the originating mutation
- [ ] Emails include a direct card link and a link to notification preferences
- [ ] Plain-text fallback is present in every outbound email

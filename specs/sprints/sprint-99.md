# Sprint 99 — Email Templates for New Notification Types

> **Status:** Planned
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 72 (Email Notifications — base SES infra + shared template), Sprint 97 (New types: card_updated, card_deleted, card_archived), Sprint 98 (card_commented dispatch)

---

## Goal

Sprint 72 delivered SES email templates for `mention`, `card_created`, `card_moved`, and `card_commented`. With three new notification types added in Sprint 97, and `card_commented` dispatch wired in Sprint 98, this sprint delivers the remaining email templates and ensures every notification type has a complete email delivery path.

**Templates to add:**

| Type | Subject |
|------|---------|
| `card_updated` | `{actorName} updated a card in {boardName}` |
| `card_deleted` | `{actorName} deleted a card in {boardName}` |
| `card_archived` | `{actorName} archived a card in {boardName}` |

The `card_commented` template already exists from Sprint 72; this sprint verifies it fires correctly end-to-end after Sprint 98's dispatch wiring.

---

## Acceptance Criteria

- [ ] SES email is sent for `card_updated`, `card_deleted`, `card_archived` when both feature flags are on and the recipient has not opted out
- [ ] Each email has a distinct subject line, a one-sentence body, and a CTA button linking to the card
- [ ] Plain-text fallback is present for every template
- [ ] `card_commented` end-to-end email verified (Sprint 72 template + Sprint 98 dispatch = working)
- [ ] Unsubscribe footer link points to `/settings/profile?tab=notifications` (Sprint 96 deep-link)
- [ ] No email is sent when `SES_ENABLED=false` or `EMAIL_NOTIFICATIONS_ENABLED=false`
- [ ] No email is sent when the recipient has `email_enabled=false` for the respective type

---

## Scope

### 1. Email Templates

**`server/extensions/notifications/mods/emailTemplates/cardUpdated.ts`**

```ts
interface CardUpdatedTemplateData {
  actorName: string;
  cardTitle: string;
  boardName: string;
  changedFields: string[]; // e.g. ['title', 'due_date']
  cardUrl: string;
}

function renderCardUpdatedEmail(data: CardUpdatedTemplateData): EmailTemplateOutput {
  const fieldList = data.changedFields
    .map(humaniseFieldName)   // 'due_date' → 'due date'
    .join(', ');

  return {
    subject: `${data.actorName} updated "${data.cardTitle}" in ${data.boardName}`,
    html: renderBase({
      heading: `Card updated`,
      body: `<b>${data.actorName}</b> made changes to <b>"${data.cardTitle}"</b> in <b>${data.boardName}</b>${fieldList ? ` (${fieldList})` : ''}.`,
      ctaLabel: 'View card',
      ctaUrl: data.cardUrl,
    }),
    text: `${data.actorName} updated "${data.cardTitle}" in ${data.boardName}.\n\nView card: ${data.cardUrl}`,
  };
}
```

**`server/extensions/notifications/mods/emailTemplates/cardDeleted.ts`**

```ts
interface CardDeletedTemplateData {
  actorName: string;
  cardTitle: string;
  boardName: string;
  boardUrl: string; // card URL is unavailable after deletion — link to board instead
}

function renderCardDeletedEmail(data: CardDeletedTemplateData): EmailTemplateOutput {
  return {
    subject: `${data.actorName} deleted "${data.cardTitle}" in ${data.boardName}`,
    html: renderBase({
      heading: `Card deleted`,
      body: `<b>${data.actorName}</b> permanently deleted the card <b>"${data.cardTitle}"</b> from <b>${data.boardName}</b>.`,
      ctaLabel: 'Open board',
      ctaUrl: data.boardUrl,
    }),
    text: `${data.actorName} deleted "${data.cardTitle}" from ${data.boardName}.\n\nOpen board: ${data.boardUrl}`,
  };
}
```

> [why] Deleted cards have no URL; the CTA links to the board page (`/boards/{boardId}`) instead to keep the email actionable.

**`server/extensions/notifications/mods/emailTemplates/cardArchived.ts`**

```ts
interface CardArchivedTemplateData {
  actorName: string;
  cardTitle: string;
  boardName: string;
  archived: boolean;  // true = archived, false = unarchived
  cardUrl: string;
}

function renderCardArchivedEmail(data: CardArchivedTemplateData): EmailTemplateOutput {
  const action = data.archived ? 'archived' : 'unarchived';
  return {
    subject: `${data.actorName} ${action} "${data.cardTitle}" in ${data.boardName}`,
    html: renderBase({
      heading: `Card ${action}`,
      body: `<b>${data.actorName}</b> ${action} the card <b>"${data.cardTitle}"</b> in <b>${data.boardName}</b>.`,
      ctaLabel: 'View card',
      ctaUrl: data.cardUrl,
    }),
    text: `${data.actorName} ${action} "${data.cardTitle}" in ${data.boardName}.\n\nView card: ${data.cardUrl}`,
  };
}
```

---

### 2. `shared.ts` — `renderBase` helper

The `renderBase` helper (from Sprint 72) wraps all templates with consistent header, footer, and unsubscribe link. Verify it accepts the `ctaLabel` / `ctaUrl` options and update the unsubscribe link to the Sprint 96 deep-link:

```ts
const settingsUrl = `${config.APP_BASE_URL}/settings/profile?tab=notifications`;
```

---

### 3. `emailDispatch.ts` — add cases for new types

**`server/extensions/notifications/mods/emailDispatch.ts`**

Extend the template selector switch:

```ts
case 'card_updated':
  return renderCardUpdatedEmail({
    actorName,
    cardTitle: data.cardTitle,
    boardName: data.boardName,
    changedFields: data.changedFields ?? [],
    cardUrl: buildCardUrl({ boardId: data.boardId, cardId: data.cardId }),
  });

case 'card_deleted':
  return renderCardDeletedEmail({
    actorName,
    cardTitle: data.cardTitle,
    boardName: data.boardName,
    boardUrl: buildBoardUrl({ boardId: data.boardId }),
  });

case 'card_archived':
  return renderCardArchivedEmail({
    actorName,
    cardTitle: data.cardTitle,
    boardName: data.boardName,
    archived: data.archived ?? true,
    cardUrl: buildCardUrl({ boardId: data.boardId, cardId: data.cardId }),
  });
```

---

### 4. Verify `card_commented` end-to-end

After Sprint 98 wired the dispatch, run the integration test path:

1. Create a card on a board with two members.
2. Member A posts a comment.
3. Assert SES `SendEmail` is called with member B's address and subject matching the `card_commented` template.

If the Sprint 72 template or Sprint 98 dispatch hook is missing test coverage, add a minimal integration test here.

---

## File Checklist

| File | Change |
|------|--------|
| `server/extensions/notifications/mods/emailTemplates/cardUpdated.ts` | New template |
| `server/extensions/notifications/mods/emailTemplates/cardDeleted.ts` | New template |
| `server/extensions/notifications/mods/emailTemplates/cardArchived.ts` | New template |
| `server/extensions/notifications/mods/emailTemplates/shared.ts` | Fix deep-link URL to `?tab=notifications` |
| `server/extensions/notifications/mods/emailDispatch.ts` | Add 3 new cases to template selector |

---

## Tests

| ID | Scenario | Expected |
|----|----------|---------|
| T1 | PATCH card title, recipient has email on | SES called with `card_updated` subject |
| T2 | PATCH card, recipient has `email_enabled=false` for `card_updated` | SES not called |
| T3 | DELETE card | SES called with `card_deleted` subject; CTA links to board URL, not card |
| T4 | Archive card | SES called with "archived" subject |
| T5 | Unarchive card | SES called with "unarchived" subject |
| T6 | `SES_ENABLED=false` | No SES calls for any type |
| T7 | `EMAIL_NOTIFICATIONS_ENABLED=false` | No SES calls for any type |
| T8 | card_commented end-to-end | SES called with commenter name + card title in subject |

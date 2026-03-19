# Sprint 67 — Automation: Scheduled Commands UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 66 (Card & Board Buttons UI), Sprint 64 (Scheduled & Due Date backend)
> **References:** Trello Automation — https://trello.com/guide/automate-anything#calendar-and-due-date-commands

---

## Goal

Complete the Automation panel by wiring up the **Schedule** tab — letting users create, view, and manage both calendar-based (daily/weekly/monthly) and due-date-triggered automations. Uses Heroicons throughout and the shared action builder from Sprint 65.

---

## Scope

### 1. Automation Panel: Schedule Tab (activating Sprint 65 placeholder)

`src/extensions/Automation/components/SchedulePanel/`

```
SchedulePanel/
  index.tsx                      # sub-panel within the Schedule tab
  ScheduleList.tsx               # lists SCHEDULED + DUE_DATE automations
  ScheduleItem.tsx               # row: icon, name, schedule summary, enable toggle, edit/delete
  ScheduleEmptyState.tsx
  builders/
    ScheduledCommandBuilder.tsx  # calendar-based command builder
    DueDateCommandBuilder.tsx    # due-date-based command builder
```

---

### 2. Scheduled Command Builder

`ScheduledCommandBuilder.tsx` is a modal with three steps:

**Step 1 — Schedule**

| Field | Options |
|-------|---------|
| Frequency | Daily / Weekly / Monthly / Yearly |
| Day (weekly) | Monday – Sunday picker |
| Day (monthly) | 1st – 31st, "Last day" |
| Time | Hour + minute picker (displayed in user's browser timezone, stored as UTC) |

**Step 2 — Actions**

Reuses `ActionList` + `ActionPicker` from Sprint 65.

Only list/board-scoped actions are available (not card-specific ones that require a single card):
- `list.sort_by_due_date`
- `list.sort_by_name`
- `list.archive_all_cards`
- `list.move_all_cards`
- `card.add_comment` (posts to all cards in a list — requires `listId` in config)

**Step 3 — Name & Save**

Summary text is automatically generated:
> "Every Monday at 09:00: archive all cards in Done"

User can override the name.

---

### 3. Due Date Command Builder

`DueDateCommandBuilder.tsx` is a modal with two steps:

**Step 1 — When**

| Field | Options |
|-------|---------|
| Timing | N days/hours **before** the due date / **on** the due date / N days/hours **after** |
| Offset value | 1–30 |
| Offset unit | Days / Hours |

Summary: "2 days before a card is due"

**Step 2 — Actions + Name + Save**

- Shares `ActionList` + `ActionPicker` from Sprint 65
- Card-scoped actions are valid here (context is each matching card)
- Auto-generated name: "2 days before due: add red label"

---

### 4. Schedule Summary Formatter

`src/extensions/Automation/utils/scheduleSummary.ts`

A pure function that converts `automation.config` → human-readable string:

```ts
scheduleSummary({ scheduleType: 'weekly', dayOfWeek: 1, hour: 9, minute: 0 })
// → "Every Monday at 09:00"

scheduleSummary({ scheduleType: 'monthly', dayOfMonth: 1, hour: 8, minute: 30 })
// → "1st of every month at 08:30"

dueDateSummary({ offsetDays: -2, triggerMoment: 'before' })
// → "2 days before due date"
```

---

### 5. Heroicons Used

| Component | Icon |
|-----------|------|
| Schedule tab label | `CalendarDaysIcon` |
| Scheduled command row | `ClockIcon` |
| Due date command row | `ExclamationCircleIcon` |
| Frequency picker | `ArrowPathIcon` |
| Time picker | `ClockIcon` |
| "Before due" | `BellAlertIcon` |
| "After due" | `BellSlashIcon` |
| Edit action | `PencilSquareIcon` |
| Delete action | `TrashIcon` |

---

### 6. Quick-Start Templates

The Schedule tab shows 3 template cards above the list for first-time users:

| Template | Schedule | Action |
|----------|----------|--------|
| Weekly board cleanup | Every Monday 09:00 | Archive all cards in "Done", move "Next Sprint" → "To Do" |
| Overdue flagging | On the due date | Add red label, post comment "@card What's the status?" |
| Monthly archive | 1st of month 08:00 | Archive all cards in "Done" |

Clicking a template opens the appropriate builder pre-populated with its config.

---

### 7. Files

```
src/extensions/Automation/
  components/
    SchedulePanel/
      index.tsx
      ScheduleList.tsx
      ScheduleItem.tsx
      ScheduleEmptyState.tsx
      builders/
        ScheduledCommandBuilder.tsx
        DueDateCommandBuilder.tsx
  utils/
    scheduleSummary.ts
```

RTK Query additions in `api.ts`: schedule commands share the same create/update/delete endpoints as other automation types.

---

## Acceptance Criteria

- [ ] Schedule tab in Automation panel is fully interactive (no "coming soon" placeholder)
- [ ] User can create a weekly scheduled command in ≤ 4 steps
- [ ] User can create a due-date command in ≤ 3 steps
- [ ] Schedule summary text is human-readable and accurate
- [ ] Quick-start templates open the appropriate builder pre-populated
- [ ] SCHEDULED and DUE_DATE automations can be enabled/disabled and deleted from the list

---

## Tests

- `tests/e2e/automation/scheduledCommands.spec.ts` — create weekly schedule, verify saved config
- `tests/e2e/automation/dueDateCommands.spec.ts` — create "2 days before" command, verify config

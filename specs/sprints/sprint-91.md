# Sprint 91 — i18n Phase 2: Automation Extension

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 90 (i18n Phase 1), Sprint 61–68 (Automation System)
> **References:** Existing pattern in `src/extensions/Card/translations/en.json`

---

## Goal

Extract all hard-coded English strings from the **Automation** extension (~20+ components across Rules, Buttons, Schedules, and Logs) into `src/extensions/Automation/translations/en.json`.

Automation is the largest single i18n target in the codebase — it spans multiple sub-features (rule builder, card buttons, board buttons, schedule builder, run log) and contains the most interface copy.

---

## Scope

### 1. New Translation File

**New file:** `src/extensions/Automation/translations/en.json`

Organise keys by sub-feature namespace:

```json
{
  "Automation.panelTitle": "Automation",
  "Automation.noRules": "No automation rules yet",
  "Automation.createFirstRule": "Create your first rule",
  "Automation.tabRules": "Rules",
  "Automation.tabButtons": "Buttons",
  "Automation.tabSchedules": "Schedules",
  "Automation.tabLog": "Log",

  "RuleBuilder.title": "Rule Builder",
  "RuleBuilder.triggerLabel": "When…",
  "RuleBuilder.actionLabel": "Then…",
  "RuleBuilder.nameLabel": "Rule name",
  "RuleBuilder.namePlaceholder": "My automation rule",
  "RuleBuilder.saveButton": "Save Rule",
  "RuleBuilder.cancelButton": "Cancel",
  "RuleBuilder.deleteButton": "Delete Rule",
  "RuleBuilder.deleteConfirm": "Delete this rule?",
  "RuleBuilder.enableToggle": "Enable rule",

  "TriggerPicker.searchPlaceholder": "Search triggers…",
  "TriggerPicker.noResults": "No matching triggers",
  "TriggerPicker.sectionLabel": "Choose a trigger",

  "ActionPicker.searchPlaceholder": "Search actions…",
  "ActionPicker.noResults": "No matching actions",
  "ActionPicker.sectionLabel": "Choose an action",
  "ActionPicker.addAction": "Add action",

  "CardButtonBuilder.namePlaceholder": "e.g. Mark as reviewed",
  "CardButtonBuilder.iconLabel": "Icon",
  "CardButtonBuilder.colorLabel": "Color",
  "CardButtonBuilder.saveButton": "Save Button",
  "CardButtonBuilder.deleteButton": "Delete Button",
  "CardButtonBuilder.deleteConfirm": "Delete this button?",

  "BoardButtonBuilder.namePlaceholder": "e.g. Archive completed cards",
  "BoardButtonBuilder.listIdPlaceholder": "Paste list ID",
  "BoardButtonBuilder.saveButton": "Save Button",
  "BoardButtonBuilder.deleteButton": "Delete Button",
  "BoardButtonBuilder.deleteConfirm": "Delete this button?",

  "ScheduleBuilder.sectionLabel": "Schedule",
  "ScheduleBuilder.calendarCommandLabel": "Calendar command",
  "ScheduleBuilder.dueDateCommandLabel": "Due date command",
  "ScheduleBuilder.saveButton": "Save Schedule",
  "ScheduleBuilder.cancelButton": "Cancel",

  "RunLog.title": "Run Log",
  "RunLog.empty": "No runs yet",
  "RunLog.statusSuccess": "Success",
  "RunLog.statusFailed": "Failed",
  "RunLog.statusSkipped": "Skipped",
  "RunLog.quotaLabel": "Monthly quota",
  "RunLog.quotaRemaining": "runs remaining",
  "RunLog.loadMore": "Load more",
  "RunLog.ariaExpandRow": "Expand run details"
}
```

---

### 2. Component Updates

Update every `.tsx` file in `src/extensions/Automation/` to import and use `translations['…']`.

Key files that contain the highest density of hardcoded strings:

| File | Typical hardcoded strings |
|------|--------------------------|
| `components/AutomationPanel/RuleBuilder/RuleBuilderFooter.tsx` | Rule name placeholder, Save/Cancel buttons |
| `components/AutomationPanel/RuleBuilder/TriggerPicker.tsx` | Search placeholder, no-results copy |
| `components/AutomationPanel/RuleBuilder/ActionPicker.tsx` | Search placeholder, no-results copy, "Add action" |
| `components/CardButtons/CardButtonBuilder.tsx` | Button name placeholder, icon/color labels |
| `components/BoardButtons/BoardButtonBuilder.tsx` | Button name placeholder, list ID placeholder |
| `components/AutomationPanel/index.tsx` | Tab labels, empty state |
| `components/RunLog/*.tsx` | Status labels, quota copy, empty state |
| `components/ScheduleBuilder/*.tsx` | Section labels, Save/Cancel buttons |

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/Automation/translations/en.json` | **Create** — all automation UI strings |
| `src/extensions/Automation/components/**/*.tsx` | Update — replace inline strings with `translations['…']` |

---

## Acceptance Criteria

- [ ] `src/extensions/Automation/translations/en.json` exists and is the single source of all English copy for the Automation feature
- [ ] No hardcoded English strings remain in any `src/extensions/Automation/` component (labels, placeholders, `aria-label`, button text, tab names, empty states, status labels)
- [ ] Components use `translations['Key']` bracket notation
- [ ] No new i18n library introduced
- [ ] All existing Automation UI behaviour is unchanged after the refactor (rules, buttons, schedules, log tabs all functional)
- [ ] Tab labels, placeholder text, and status badges are all driven from the JSON file

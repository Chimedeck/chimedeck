> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 91 — Iteration 4: Automation Extension i18n Extraction

Purpose
- Verify all visible Automation UI copy is sourced from
  `src/extensions/Automation/translations/en.json`.
- Confirm UI behaviour is unchanged after replacing hardcoded strings.

Preconditions
- Dev server is running.
- A board with at least one automation rule, one card button, one board button,
  one scheduled command, and run-log history is available (or create them during
  the test steps).

## Steps

### Automation panel tabs

1. Open a board and click the Automation header button (bolt icon, aria-label
   "Open automation panel").
2. Assert the panel title is "Automation".
3. Assert the four tab labels are visible: "Rules", "Buttons", "Schedule", "Log".
4. Assert the empty-state title "No automations yet" and description "Get started
   by creating your first rule." appear on the Rules tab when no rules exist.
5. Assert the "Create your first rule" button is visible in the empty state.

### Rule Builder

6. Click "Create your first rule" (or the + button on the Rules tab).
7. Assert the back-navigation aria-label "Back to rules" is present.
8. Assert the trigger picker label "When…" appears.
9. Assert the action list label "Then…" and "Add action" button are visible.
10. Assert the Rule name field label "Rule name" and placeholder "Give this rule
    a name" appear.
11. Assert the "Cancel" and "Save rule" footer buttons are present.

### Trigger & Action Pickers

12. Click the trigger picker input and assert the placeholder "Search triggers…".
13. Assert the loading indicator and/or "No matching triggers" empty state when
    search has no results.
14. Open the action picker via "Add action" and assert the placeholder
    "Search actions…".
15. Assert "No matching actions" empty state when search has no results.
16. Assert "Cancel" button inside the action picker is visible.

### Card / Board Buttons Tab

17. Navigate to the Buttons tab.
18. Assert the "Card buttons" and "Board buttons" section headings are visible.
19. Assert "Add card button" and "Add board button" labels are present.
20. Click "Add card button" and assert the modal title "New Card Button".
21. Assert the name field label "Button name" and placeholder "e.g. Mark as
    reviewed" appear.
22. Assert the icon picker label "Icon" is visible.
23. Assert "Cancel" and "Create button" footer buttons.
24. Close the modal.

### Schedule Tab

25. Navigate to the Schedule tab.
26. Assert the "Scheduled rules" and "Due date rules" section headings.
27. Click "New scheduled rule" and assert the dialog aria-label "New scheduled
    command" and header title "New Scheduled Command".
28. Assert step labels (e.g. "Schedule", "Actions", "Save") in the step
    indicator.
29. Assert the "Frequency" label and the four frequency buttons "daily",
    "weekly", "monthly", "yearly".
30. Assert the "Time (your browser timezone)" label and Hour/Minute selectors.
31. Assert the footer "Cancel" and "Next" buttons.
32. Close the dialog.
33. Click "New due date rule" and assert the dialog aria-label "New due-date
    command" and header title "New Due Date Command".
34. Assert step label "When" and timing buttons "Before", "On the day", "After".
35. Assert the "Timing" label and "Offset" label (when Before or After is
    selected).
36. Assert "Cancel" and "Next →" footer buttons.
37. Close the dialog.

### Run Log Tab

38. Navigate to the Log tab.
39. Assert the column headers "Rule / Button", "Trigger", "Status", "Time" are
    visible when run history exists.
40. Assert status badge labels "Success", "Failed", or "Skipped" appear as
    defined in translations.
41. Assert the previous/next pagination aria-labels "Previous page" / "Next
    page" are present when multiple pages exist.
42. Expand a log row and assert the "Error" or "Context" section headings appear.

Expected
- All listed copy matches the values in `translations/en.json`.
- Clicking buttons, filling inputs, and navigating between steps works exactly
  as before the i18n extraction.
- No JavaScript errors appear in the browser console.
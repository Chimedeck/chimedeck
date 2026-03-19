# Sprint 92 — i18n Phase 3: Plugins Extension

> **Status:** Future sprint — not scheduled yet
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 90 (i18n Phase 1), Sprint 34–39 (Plugin System)
> **References:** Existing pattern in `src/extensions/Card/translations/en.json`

---

## Goal

Extract all hard-coded English strings from the **Plugins** extension (~15 components, modals, and forms) into `src/extensions/Plugins/translations/en.json`.

The Plugins feature includes a plugin search bar, registration modal, edit modal, board integration panel, and admin dashboard — all of which contain dense amounts of interface copy that is currently hardcoded.

---

## Scope

### 1. New Translation File

**New file:** `src/extensions/Plugins/translations/en.json`

Organise keys by component namespace:

```json
{
  "Plugins.dashboardTitle": "Plugins",
  "Plugins.noPlugins": "No plugins installed",
  "Plugins.browseButton": "Browse Plugins",
  "Plugins.enabledBadge": "Enabled",
  "Plugins.disabledBadge": "Disabled",

  "PluginSearchBar.placeholder": "Search plugins…",
  "PluginSearchBar.noResults": "No matching plugins",
  "PluginSearchBar.ariaLabel": "Search plugins",

  "RegisterPluginModal.title": "Register Plugin",
  "RegisterPluginModal.namePlaceholder": "My Awesome Plugin",
  "RegisterPluginModal.descriptionPlaceholder": "What does this plugin do?",
  "RegisterPluginModal.urlLabel": "Plugin URL",
  "RegisterPluginModal.urlPlaceholder": "https://",
  "RegisterPluginModal.categoryLabel": "Category",
  "RegisterPluginModal.domainsLabel": "Allowed domains",
  "RegisterPluginModal.domainsPlaceholder": "Type and press Enter or comma to add",
  "RegisterPluginModal.submitButton": "Register",
  "RegisterPluginModal.cancelButton": "Cancel",
  "RegisterPluginModal.apiKeyTitle": "API Key (shown once)",
  "RegisterPluginModal.apiKeyCopyButton": "Copy",
  "RegisterPluginModal.apiKeyCopied": "Copied!",

  "EditPluginModal.title": "Edit Plugin",
  "EditPluginModal.urlPlaceholder": "https://api.example.com — press Enter to add",
  "EditPluginModal.saveButton": "Save Changes",
  "EditPluginModal.cancelButton": "Cancel",
  "EditPluginModal.deleteButton": "Delete Plugin",
  "EditPluginModal.deleteConfirm": "Delete this plugin? This cannot be undone.",
  "EditPluginModal.domainsLabel": "Allowed domains",
  "EditPluginModal.domainsPlaceholder": "Type and press Enter or comma to add",

  "BoardPluginsPanel.title": "Board Plugins",
  "BoardPluginsPanel.enableButton": "Enable",
  "BoardPluginsPanel.disableButton": "Disable",
  "BoardPluginsPanel.configureButton": "Configure",
  "BoardPluginsPanel.noPlugins": "No plugins available for this board",
  "BoardPluginsPanel.ariaClose": "Close plugins panel",

  "PluginDomainAllowlist.title": "Allowed Domains",
  "PluginDomainAllowlist.addPlaceholder": "Add domain…",
  "PluginDomainAllowlist.addButton": "Add",
  "PluginDomainAllowlist.emptyState": "No domains added yet",
  "PluginDomainAllowlist.removeAriaLabel": "Remove domain"
}
```

---

### 2. Component Updates

Key files with the highest density of hardcoded strings:

| File | Typical hardcoded strings |
|------|--------------------------|
| `components/PluginSearchBar.tsx` | Placeholder, aria-label, no-results copy |
| `modals/RegisterPluginModal.tsx` | All form labels, placeholders, API key reveal copy |
| `modals/EditPluginModal.tsx` | URL placeholder, delete confirm, domain field labels |
| `components/BoardPluginsPanel.tsx` | Panel title, enable/disable/configure buttons, empty state |
| `components/PluginDashboard.tsx` | Dashboard title, enabled/disabled badges, browse button |
| `PluginDomainAllowlist.tsx` | Title, add field placeholder, remove aria-label |

---

## File Checklist

| File | Change |
|------|--------|
| `src/extensions/Plugins/translations/en.json` | **Create** — all plugin UI strings |
| `src/extensions/Plugins/components/**/*.tsx` | Update — replace inline strings with `translations['…']` |
| `src/extensions/Plugins/modals/**/*.tsx` | Update — replace inline strings with `translations['…']` |

---

## Acceptance Criteria

- [ ] `src/extensions/Plugins/translations/en.json` exists and covers all user-visible strings in the Plugins feature
- [ ] No hardcoded English strings remain in `src/extensions/Plugins/` (labels, placeholders, `aria-label`, button text, modal titles, empty states, badge text)
- [ ] The one-time API key reveal copy, domain chip instructions, and delete confirmations are all sourced from the JSON
- [ ] Components use `translations['Key']` bracket notation
- [ ] No new i18n library introduced
- [ ] All existing Plugin registration, editing, board panel, and domain allowlist UI behaviour is unchanged

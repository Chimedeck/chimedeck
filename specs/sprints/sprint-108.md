# Sprint 108 — MCP Docs Page

> **Status:** Planned
> **Depends on:** Sprint 106 (Remote MCP / HTTP transport), Sprint 107 (MCP read tools)

---

## Goal

Add a **"MCP Docs"** entry to the main sidebar that opens a developer-reference page documenting the Taskinate MCP server — how to connect, how to authenticate, and the full list of available tools with their input schemas and example usage.

The page follows the same pattern as the existing **Plugin Docs** page (`/developer/plugins`): a static React documentation page with a left-hand table of contents, served at `/developer/mcp`, and reachable from the sidebar without requiring a workspace to be active.

---

## Background

After Sprints 106 and 107 the MCP server exposes 9 tools over HTTP. There is no discoverable user-facing documentation for it. Operators, developers, and power users who want to connect an AI agent (Claude.ai, Cursor, a custom agent) need to know:

- The endpoint URL structure
- How to generate and use an API token (`hf_…`)
- Which tools exist and what input each takes

The Plugin Docs page (`PluginDocsPage.tsx`) is a well-established pattern in the codebase — a full-page React component with a sticky TOC sidebar, reachable via a sidebar nav item and a lazy-loaded route. MCP Docs follows that pattern exactly.

---

## Architecture

```
src/extensions/DeveloperDocs/containers/
├── PluginDocsPage/
│   └── PluginDocsPage.tsx          ← existing, untouched
└── McpDocsPage/
    └── McpDocsPage.tsx             ← new
```

The page is:
- **Lazy-loaded** via `React.lazy` in `src/routing/index.tsx` (mirrors the Plugin Docs lazy import).
- **Routed** at `/developer/mcp` inside the existing `AppShell` private route tree.
- **Linked** from the main `Sidebar.tsx` with a `NavItem` and a translation key `Sidebar.mcpDocsLabel`.
- **Linked** from the workspace-scoped `src/extensions/Workspace/components/Sidebar.tsx` as well, keeping it consistent with the Plugin Docs entry that appears in both sidebars.

---

## Page Content

The page documents the MCP server comprehensively. Sections (TOC):

| # | Section | Content |
|---|---------|---------|
| 1 | Overview | What Taskinate MCP is; two things needed to connect (URL + API token) |
| 2 | Authentication | How to generate an `hf_` API token via Profile → API Tokens; how to pass it as `Authorization: Bearer hf_…` |
| 3 | Connecting | Claude.ai remote MCP config snippet; Cursor `mcp.json` snippet; raw `curl` example |
| 4 | Endpoint reference | `POST /api/mcp`, `GET /api/mcp` (SSE), `DELETE /api/mcp`; session lifecycle |
| 5 | Available tools | Table of all 9 tools with name, description, required inputs |
| 6 | Tool details | One sub-section per tool with full input schema and an example JSON payload |

### Tools documented (9 total after Sprint 107)

| Tool name | Sprint introduced | Type |
|-----------|------------------|------|
| `move_card` | 105 | write |
| `write_comment` | 105 | write |
| `create_card` | 105 | write |
| `edit_description` | 105 | write |
| `set_card_price` | 105 | write |
| `invite_to_board` | 105 | write |
| `search_cards` | 107 | read |
| `search_board` | 107 | read |
| `get_card` | 107 | read |

---

## Files Affected

| File | Change |
|------|--------|
| `src/extensions/DeveloperDocs/containers/McpDocsPage/McpDocsPage.tsx` | **New** — full static docs page component |
| `src/routing/index.tsx` | Add lazy import + `<Route path="/developer/mcp" element={<McpDocsPage />} />` inside `AppShell` |
| `src/layout/Sidebar.tsx` | Add `NavItem` for `"MCP Docs"` at `/developer/mcp` (after Plugin Docs entry) |
| `src/extensions/Workspace/components/Sidebar.tsx` | Add matching `NavItem` (mirrors main sidebar) |
| `src/common/translations/en.json` | Add `"Sidebar.mcpDocsLabel": "MCP Docs"` |

---

## Sidebar Placement

Insert the **MCP Docs** nav item immediately after **Plugin Docs** in both sidebars, using the `CommandLineIcon` from `@heroicons/react/24/outline`:

```tsx
<NavItem
  to="/developer/mcp"
  icon={<CommandLineIcon className="h-5 w-5" />}
  label={layoutTranslations['Sidebar.mcpDocsLabel']}
  collapsed={collapsed}
  onNavigate={onClose}
/>
```

---

## Route Registration

Lazy-loaded, consistent with the existing pattern in `src/routing/index.tsx`:

```tsx
const McpDocsPage = React.lazy(() =>
  import('~/extensions/DeveloperDocs/containers/McpDocsPage/McpDocsPage').then((m) => ({
    default: m.default,
  })),
);

// Inside AppShell private routes:
<Route path="/developer/mcp" element={<McpDocsPage />} />
```

---

## Acceptance Criteria

- [ ] "MCP Docs" nav item appears in the sidebar below "Plugin Docs", visible to all authenticated users
- [ ] Clicking "MCP Docs" navigates to `/developer/mcp`
- [ ] The page renders with a sticky left TOC and main content column (mirrors Plugin Docs layout)
- [ ] All 6 sections are present: Overview, Authentication, Connecting, Endpoint Reference, Available Tools, Tool Details
- [ ] All 9 tools are documented with their input schema
- [ ] Claude.ai remote MCP and Cursor `mcp.json` config snippets are included
- [ ] The route is lazy-loaded and does not increase the initial bundle
- [ ] No compilation errors; existing Plugin Docs page is untouched

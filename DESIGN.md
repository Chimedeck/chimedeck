# DESIGN.md

Project: Chimedeck
Owner: Product + Design + Engineering
Status: Living document
Last updated: 2026-06-03

---

## 1. Purpose

This document defines the end-to-end product design system for Chimedeck, including:

- Product experience goals
- User roles and permissions impact on UX
- Information architecture and navigation model
- Core interaction flows and UI states
- Visual language, components, and behavior rules
- Accessibility, performance, and quality standards
- Feature evolution roadmap for upcoming capabilities

It is intended to align product, design, and engineering around one shared UX contract.

---

## 2. Product Definition

Chimedeck is an open-source collaborative work management platform centered on:

- Workspace -> Boards -> Lists -> Cards
- Real-time multi-user collaboration
- Comments, attachments, notifications, automation, plugins
- Multiple board views (Kanban default, with optional views)
- Extensibility through API, CLI, MCP, and plugin architecture

Primary value proposition:

- Organize and execute work visually at team scale
- Keep collaboration contextual and searchable
- Enable customization without fragmenting core UX

---

## 3. Design Principles

1. Board-first productivity
- The board is the primary work surface; all key actions should be one or two interactions away.

2. Clarity over cleverness
- Prioritize readable information hierarchy and explicit labels over hidden or ambiguous interactions.

3. Safe collaboration by default
- Real-time changes should feel immediate but predictable, with rollback-safe UI behavior.

4. Permission-aware UX
- UI must reflect role constraints without exposing dead-end controls.

5. Progressive complexity
- New users should succeed with defaults; power users should unlock advanced capabilities (automation, plugins, API, AI).

6. Consistent extension model
- Plugins and feature extensions should feel native and follow shared visual and interaction contracts.

---

## 4. User Types and UX Expectations

### Workspace roles

- Owner: global control, all workspace and board admin functions
- Admin: broad management and board-level administration
- Member: standard create/edit collaboration across accessible boards
- Viewer: read-only board participation
- Guest: board-scoped access, no workspace-wide visibility

### Board roles

- Board Admin: board settings, membership, governance
- Board Member: day-to-day card and list operations
- Board Viewer: read-only board content

### Role-driven UX rules

- Never show destructive or privileged controls to users lacking permission.
- If visibility is needed for context, render disabled state with clear reason.
- Guest experiences must remain intentionally scoped and minimal.

---

## 5. Information Architecture

### Top-level areas

1. Authentication
- Login, signup, OAuth, session recovery

2. Workspace shell
- Workspace switcher, board grid/list, navigation rails

3. Board workspace
- Header actions, view switcher, board content area, side panels, modals

4. Card detail
- Rich modal for content, comments, history, attachments, metadata

5. User settings
- Profile, notifications, API tokens, role-aware preferences

6. Admin and platform surfaces
- Plugin registry, external user invites, governance areas

### Board-level IA

- Board header: title, key actions, plugin access, settings, contextual controls
- Primary canvas: active view (Kanban or alternate)
- Secondary surfaces: side panels, command palette, modals
- Local overlays: notifications, comments, inline editors, popovers

---

## 6. Navigation Model

### Primary navigation

- Workspace-level navigation drives board discovery and context switching
- Board route is the primary execution context

### Secondary navigation

- Board tabs or segmented controls for view modes
- Board settings and plugin panels as contextual destinations

### Deep linking

- Support URL-driven entry to major panels and tabs
- Preserve significant board context in route/query state

---

## 7. Core Interaction Flows

### 7.1 Authentication and session continuity

- User logs in with email/password or OAuth
- Session survives refresh when valid
- Expired or revoked session exits cleanly and immediately

### 7.2 Workspace and board lifecycle

- Create workspace
- Create/open board
- Rename/update board settings
- Delete with confirmation safeguards

### 7.3 Kanban operations

- Create list
- Create card
- Drag card across lists
- Edit card details in modal
- Persist with optimistic updates and deterministic reconciliation

### 7.4 Collaboration flows

- Add comments
- Upload/manage attachments
- Track immutable activity history
- Receive notifications and mention alerts

### 7.5 Search and retrieval

- Global and board-scoped findability
- Keyboard-assisted command/search entry
- Permission-aware result filtering

---

## 8. Real-Time UX Contract

### Perceived behavior

- Local user action should feel instant
- Remote changes should appear quickly and consistently

### Error and conflict handling

- If optimistic update fails, UI reverts cleanly with user-readable reason
- No silent data corruption or stale-success states

### Presence and continuity

- Real-time indicators should be informative, not distracting
- Reconnect and degraded-mode behavior must be explicit

---

## 9. Permission and Visibility UX Matrix

### Board visibility

- Private: explicit access only
- Workspace: visible to workspace roles by policy
- Public: viewable without auth, edit still role-controlled

### Guardrails

- Access checks are enforced server-side first
- Client mirrors policy to prevent misleading affordances
- Guest scope must prevent workspace-wide discovery leakage

---

## 10. Visual System

The product visual system is token-driven and centralized.

### Token source of truth

- src/index.css: theme tokens for light and dark mode
- tailwind.config.ts: token-to-utility mappings
- src/config/theme.ts: component variant strings

### Visual direction

- Dense productivity UI with clear hierarchy
- High legibility for board-heavy surfaces
- Consistent semantic colors for status and risk

### Color semantics

- Primary: action and focus
- Secondary/accent: supporting emphasis
- Semantic: success, warning, danger, info

### Typography and spacing

- Prioritize scanability in list/card-heavy interfaces
- Maintain stable spacing rhythm across board, modal, sidebar, and form surfaces

---

## 11. Component System

### Core primitives

- Buttons (primary, secondary, ghost, danger, success)
- Inputs, selects, textareas, toggles
- Modals, drawers, popovers, tooltips
- Banners and toasts

### Domain components

- Board header controls
- List column container
- Card tile and card modal
- Comment thread and activity stream
- Attachment item and preview surfaces
- Plugin injection slots

### Component rules

- Reuse variants from centralized theme config
- No ad-hoc styles when equivalent design token exists
- Interactive elements must include visible focus states

---

## 12. Content Design and Microcopy

### Tone

- Clear, direct, operational
- Avoid vague system messages

### Writing rules

- Action labels start with verbs
- Error messages explain what happened and what to do next
- Permission-denied messages explain role requirement

### Terminology consistency

- Use one canonical term per concept (for example board, list, card, workspace)
- Avoid duplicate synonyms in user-facing UI

---

## 13. Accessibility Standards

### Baseline requirements

- Keyboard navigable core flows
- Logical tab order for board, modal, and settings interactions
- Escape closes transient overlays where applicable
- Sufficient color contrast in both light and dark themes
- Semantic labels for controls and icon-only buttons

### Board-specific concerns

- Drag-and-drop must have keyboard fallback where practical
- Real-time updates should not break screen reader context
- Dynamic panels should manage focus on open/close

---

## 14. Responsive Behavior

### Desktop first execution

- Rich board canvas with side panels and overlays

### Mobile adaptation

- Prioritize quick card actions and essential board controls
- Collapse secondary controls into compact menus
- Use full-width overlays for complex panels and editors

### Minimum support

- Core journeys must remain usable at 375px viewport width

---

## 15. Performance Experience Targets

### UX targets

- Board interactions remain responsive with large card volume
- No blocked UI during standard create/edit/move operations
- Perceived real-time updates within one second under normal network conditions

### Product-level budget direction

- Keep initial board load lightweight
- Progressive loading for heavy side panels and secondary surfaces
- Use skeletons and placeholders for async content

---

## 16. Quality and Testing Strategy (Design-Oriented)

### Must-test journeys

1. Sign-in to board to card operations
2. Multi-user edit and move concurrency
3. Role-specific permissions for workspace, board, and guest scope
4. Attachments, comments, and notifications end-to-end
5. Feature-flag on/off behavior for major optional capabilities

### UX regression checks

- Empty states and error states on all critical surfaces
- Mobile and keyboard accessibility sanity checks
- No blocking console/runtime errors in nominal user flows

---

## 17. Feature Expansion Design Track

The current roadmap includes high-impact experience additions that must remain consistent with this DESIGN.md contract.

### 17.1 Board chat and AI workflow

- Board header chat entry near plugin/settings controls
- Right sidebar chat with history
- Guest visibility/use policy controls
- Dual storage model for conversation (raw + vector)
- AI provider adapter for OpenAI-compatible endpoints
- Function-triggered card creation from chat context

### 17.1.1 Board Chat Sidebar UI Specification (Reference)

This section captures the target sidebar UI shape for board chat.

Layout zones (top to bottom):

1. Header bar
- Title: `Board Chat`
- Actions: history, options, close
- Always sticky at top of drawer

2. Guest access controls block
- Status caption (for example `GUEST ACCESS (MEMBER ONLY)`)
- Two primary controls:
	- `ALLOW GUEST TO VIEW`
	- `ALLOW GUEST TO USE`
- Lock/disabled state for users without permission

3. Conversation timeline
- Day separators (`TUESDAY, OCT 24` style)
- Member messages with avatar, name, timestamp
- Assistant/system cards visually distinct from member bubbles

4. AI suggestion card (when applicable)
- Assistant may render a suggested-card block containing:
	- inferred card title
	- source/confidence helper text
	- primary CTA: `Create card`
	- secondary action: dismiss/ignore suggestion

5. Composer footer
- Sticky input row with message field + send button
- Secondary utility row with mention/emoji shortcuts
- `AI Assist` quick action pinned near composer controls

Behavior rules:

- Message timeline scrolls independently; header and composer remain fixed.
- Drawer is fixed-width on desktop and full-width overlay on narrow/mobile viewports.
- Guests who lack `view` permission do not see timeline content.
- Guests who lack `use` permission can read (if allowed) but composer is disabled.
- Role/permission checks are enforced server-side and mirrored client-side.

### 17.2 GitHub project specifications workflow

- Board settings field for GitHub project URL
- Backend function to resolve URL to downloaded repository path
- Read markdown specs from repository specs folder
- Board-level `Documentation` button/tab next to `Health Check` opens the markdown workspace
- Client markdown view/edit workflow using TipTap Markdown mode
- Server commit and push flow for changed/new markdown files

Implementation decision:

- Editor: TipTap Markdown mode for interactive editing with markdown-text persistence.
- Fetch pipeline: GitHub App installation token + server-side Git wrapper for clone/fetch.
- Commit pipeline: server-side Git service wrapper for add/commit/push, restricted to `specs/**/*.md`, authored as app bot alias identity.
- Performance pipeline: manifest-first load, lazy per-file content fetch, delta-save (changed files only), and ETag/sha validation.

Design constraints for these additions:

- Permission-first UX
- Clear auditability of AI and repository writes
- Role-gated controls with transparent status feedback

---

## 18. Non-Goals

- Introducing disconnected visual languages per extension
- Allowing plugins or advanced features to bypass role rules
- Shipping complex workflows without explicit error and empty-state design

---

## 19. Governance

### Change process

- Design-impacting changes should update this file in the same delivery stream
- Feature specs in specs/sprints should map to sections in this document
- Significant UX shifts should include changelog notes and acceptance criteria updates

### Decision ownership

- Product defines user outcomes and prioritization
- Design defines interaction patterns and content clarity
- Engineering defines implementation strategy while preserving UX contract

---

## 20. Definition of Done for Design Quality

A feature is design-complete when:

1. Permission behavior is explicit and correct in UI and API outcomes.
2. Empty, loading, success, and error states are implemented.
3. Keyboard and basic accessibility checks pass for the main flow.
4. Responsive behavior is validated for desktop and mobile.
5. Copy is clear, consistent, and actionable.
6. Interaction aligns with tokenized visual system and component standards.

---

## 21. References

- README.md
- FEATURES.md
- docs/THEME.md
- specs/architecture/requirements.md
- specs/architecture/technical-decisions.md
- specs/sprints/sprint-plan.md

Note on external reference:

This DESIGN.md was structured to follow a design-md style approach requested with Stitch documentation as reference. If the Stitch page structure changes, this file can be remapped section-by-section while preserving project-specific content.

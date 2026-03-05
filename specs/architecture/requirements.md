# Vello Application Requirements

## 1. Goal and Scope

The system is a task management application that organizes work hierarchically as:

- **Workspace → Boards → Tasks (cards)**
- Within a board, tasks are arranged using a **Board View**.
  - Default: **Lists (Kanban)**
  - Optional: **Timeline/Gantt**, **Calendar**
  - Optional: **Table**, **Filtered Views**

The MVP’s core user value is visual task organization and simple task workflows reflecting typical board/list/card interactions from Trello’s product model.

**In scope for MVP:** create/update/delete workspaces, boards, lists, tasks; move tasks between lists; basic views, team collaboration, user permissions, integrations, notifications, power-ups
**Out of scope for MVP unless explicitly noted:** automated rules, shared board templates, , advanced filters.

---

## 2. Glossary and Definitions

- **Workspace**: Top-level grouping of boards.  
- **Board**: A container for tasks and views.  
- **Task/Card**: A unit of work that can include title, description, status, and optionally due dates and custom fields.
- **List**: A column grouping tasks in the Lists view (Kanban) based on a nominated field from the task.  
- **View Types (Board Views)**: Distinct board presentations and interactions (e.g. Table, Khanban, Calendar, GANTT). 
- **Filters**: UI tools to search or limit visible tasks by text or fields.
- **Template** (optional): A pre-configured board definition that can be cloned.

---

## 3. Authentication
**U-ATH-01 (Ubiquitous)**  
The system shall allow a user to login with email and password

**U-ATH-02 (Ubiquitous)**  
The system shall allow a user to reset their password

**U-ATH-03 (Ubiquitous)**  
The system shall allow a user to login with oAuth (Google and Github)

**U-ATH-04 (Ubiquitous)**  
The system shall expire access tokens after 24 hours

**U-ATH-05 (Ubiquitous)**  
The system will rotate refresh tokens every XX hours

**U-ATH-06 (Ubiquitous)**  
The system shall ensure that Web Browser Sessions survive refresh

**U-ATH-07 (Event-Driven)**  
When a session token is revoked the system shall immiediately invalidate the token

**U-ATH-08 (Event-Driven)**  
When a token becomes invalid the system shall log out the user immediately

**U-ATH-09 (Event-Driven)**  
When a session expires the system shall attemp a silent refresh


## 3. User Roles & Authorization

### Workspace Roles

- Owner (immutable workspace owner)
- Admin - can administer the workspace including all boards
- Member - can be a member on boards based on the board type
- Guests - users external to the workspace members that have been invited to work on boards. Guests can only view and edit the boards to which they've been added.

### Board Visibility Settings
- Private - Board members and Workspace Admins can see and edit this board
- Workspace - All admins/members of the Workspace can see and edit this board, All Viewers can view this board.
- Public - Anyone on the internet can see this board, but only board members can edit this board

### Board Member Roles
- Admin - can add and remove admins, members and viewers
- Member - can view and edit board tasks
- Viewer - can view board tasks

---

## 4. EARS Requirements

### 4.1 Workspace Requirements

**U-WKS-01 (Ubiquitous)**  
The system shall allow a user to create a workspace.

**U-WKS-02 (Ubiquitous)**  
The system shall allow a user to view all workspaces.

**U-WKS-03 (Ubiquitous)**  
The system shall allow a user to rename a workspace.

**U-WKS-04 (Ubiquitous)**  
The system shall allow a user to delete a workspace.

**S-WKS-05 (State-Driven)**  
While a workspace contains boards, the system shall require confirmation before deleting the workspace.

---

### 4.2 Board Requirements

**U-BRD-01 (Ubiquitous)**  
The system shall allow a user to create a board in a workspace.

**U-BRD-02 (Ubiquitous)**  
The system shall allow a user to view boards in a workspace.

**U-BRD-03 (Ubiquitous)**  
The system shall allow a user to open a board.

**U-BRD-04 (Ubiquitous)**  
The system shall allow a user to rename a board.

**U-BRD-05 (Ubiquitous)**  
The system shall allow a user to delete a board.

**S-BRD-06 (State-Driven)**  
While a board contains tasks, the system shall require confirmation before deleting the board.
user can add/edit a description for the board.
user can add/edit a background for the board.
user can add/edit the visibility for a board.
user can "star" a board as favorites.
user can filter the list of boards by favorites.
user can add/edit custom fields for the tasks on a board.
user can add/edit label defintions for the tasks on a board.
user can view all the activity for a board.
user can view all the comments for a board.
user can view archived tasks for a board.
user can receive notifications about activity and comments on a board by following the board.


---

### 4.3 Task/Card Requirements (Core)

**U-TSK-01 (Ubiquitous)**  
The system shall allow a user to create a task/card in a board.

**U-TSK-02 (Ubiquitous)**  
The system shall allow a user to edit a task’s title.

**U-TSK-03 (Ubiquitous)**  
The system shall allow a user to edit a task’s description.

**U-TSK-04 (Ubiquitous)**  
The system shall allow a user to delete a task.

**U-TSK-05 (Ubiquitous)**  
The system shall allow a user to view a task’s details.

**U-TSK-06 (Ubiquitous)**  
The system shall allow a user to assign optional fields to tasks (e.g., due dates, custom fields). :contentReference[oaicite:7]{index=7}

**U-TSK-07 (Ubiquitous)**  
The system shall ensure each task belongs to exactly one board.

---

### 4.4 Board View Framework

**U-VIEW-01 (Ubiquitous)**  
The system shall provide multiple board view types.

**U-VIEW-02 (Ubiquitous)**  
The system shall allow a user to set a board’s active view type.

**S-VIEW-03 (State-Driven)**  
While a board is open, the system shall display tasks using the active view type.

**E-VIEW-04 (Event-Driven)**  
When a user changes the view type, the system shall persist the selected view type for that user.

**U-VIEW-05 (Ubiquitous)**  
The system shall ensure tasks remain consistent regardless of view type.

---

### 4.5 Lists View Controller (MVP Default)

**U-LST-01 (Ubiquitous)**  
The system shall provide a Lists (Kanban) view controller.

**U-LST-02 (Ubiquitous)**  
The system shall set Lists as the default view for new boards.

**U-LST-03 (Ubiquitous)**  
The system shall allow a user to create a list.

**U-LST-04 (Ubiquitous)**  
The system shall allow a user to rename a list.

**U-LST-05 (Ubiquitous)**  
The system shall allow a user to delete a list.

**U-LST-06 (Ubiquitous)**  
The system shall allow a user to reorder lists.

**S-LST-07 (State-Driven)**  
While Lists view is active, the system shall assign each task to exactly one list.

**E-LST-08 (Event-Driven)**  
When a user moves a task between lists, the system shall persist the list assignment.

**E-LST-09 (Event-Driven)**  
When a user reorders tasks within a list, the system shall persist the order.

**S-LST-10 (State-Driven)**  
While a list contains tasks, the system shall require confirmation before deleting the list.

---

### 4.6 Optional Additional Views

#### 4.6.1 Calendar View

**U-CAL-01 (Ubiquitous)**  
The system shall support a Calendar view that shows tasks by due date.

**S-CAL-02 (State-Driven)**  
While Calendar view is active, tasks shall appear on the calendar based on due dates.

**E-CAL-03 (Event-Driven)**  
When a user edits a task’s due date via Calendar view, the system shall persist the change.

#### 4.6.2 Timeline/Gantt View

**U-GNT-01 (Ubiquitous)**  
The system shall support a Timeline/Gantt view that arranges tasks by time range.

**S-GNT-02 (State-Driven)**  
While Timeline view is active, the system shall arrange tasks on a timeline based on start/end dates.

**E-GNT-03 (Event-Driven)**  
When a user edits task dates in timeline view, the system shall persist the changes.

---

### 4.7 Navigation & Filters

**U-NAV-01 (Ubiquitous)**  
The system shall allow navigation from a workspace to any board.

**U-NAV-02 (Ubiquitous)**  
The system shall allow navigation from a board to a task detail view.

**U-FLT-01 (Ubiquitous)**  
The system shall allow users to filter or search tasks by text or fields. :contentReference[oaicite:8]{index=8}

---

## 5. Data Integrity Constraints

**U-DATA-01 (Ubiquitous)**  
The system shall ensure every board belongs to one workspace.

**U-DATA-02 (Ubiquitous)**  
The system shall ensure every task belongs to one board.

**U-DATA-03 (Ubiquitous)**  
The system shall ensure persistence and recovery of view-specific task state (lists, dates).

---

## 6. Non-Functional Requirements

**U-NFR-01 (Ubiquitous)**  
The system shall persist state across refresh/restart.

**U-NFR-02 (Ubiquitous)**  
The system shall ensure no acknowledged write is lost.

**U-NFR-03 (Ubiquitous)**  
The system shall ensure all clients converge to identical board state - deterministic concurrency

**U-NFR-04 (Ubiquitous)**  
The system shall maintain an append-only activity log (event immutability)

**U-NFR-05 (Ubiquitous)**  
The system shall ensure that the server is the source of truth (permission correctness)

**U-NFR-06 (Ubiquitous)**  
The system shall ensure that clients converge within 1 second (Eventual real-time consistency)

**U-NFR-07 (Ubiquitous)**  
The system shall ensure that failed optimistic updates revert cleanly (UI rollback safety)

**U-NFR-08 (Ubiquitous)**  
The system shall maintain UI responsiveness with up to 1,000 tasks per board.

**U-NFR-09 (Ubiquitous)**  
The system shall provide basic guardrails and validation for required fields.

**U-NFR-10 (Ubiquitous)**  
The system shall run on modern desktop browsers.

**U-NFR-11 (Ubiquitous)**  
The system will use UUID v7 or sortable ID for all entities.

---

## 7. Future / Extension Considerations

These features reflect Trello’s broader paradigm and could be phased for later releases:

- **Tags/Labels** on tasks. :contentReference[oaicite:9]{index=9}  
- **Checklists/Sub-tasks** within tasks. :contentReference[oaicite:10]{index=10}  
- **File attachments & comments**. :contentReference[oaicite:11]{index=11}  
- **Import via email or capture inbox** features. :contentReference[oaicite:12]{index=12}  
- **Board Templates** for common workflows. :contentReference[oaicite:13]{index=13}  
- **Automation rules** (butler-style). :contentReference[oaicite:14]{index=14}  
- **User collaboration & permissions**.

---



---

## 5. Functional Requirements

### 5.1 Authentication

Supported methods:

- Email/password
- OAuth (Google, GitHub)



---

### 5.2 Workspace Lifecycle

Operations:

- Create workspace
- Invite user
- Accept invite
- Remove user
- Assign role

Invite rules:

- Invite token is single-use
- Invite expires after configurable TTL
- Expired token returns HTTP 410

Invariant:

A workspace must always have ≥ 1 Owner.

---

### 5.3 Board Lifecycle

States:

- active
- archived
- deleted (hard delete)

Rules:

- Archived boards are read-only
- Delete is irreversible
- Duplicate copies lists + cards + metadata

---

### 5.4 Lists

Operations:

- Create
- Rename
- Reorder
- Archive

Concurrency rules:

- List ordering uses fractional index
- Server resolves collisions
- Final order is deterministic

Acceptance:

Reordering never drops a list.

---

### 5.5 Cards

Card schema:

- title (required, ≤ 512 chars)
- description (markdown)
- labels (max 20)
- assigned members
- due date
- attachments
- checklist items
- comments
- archived flag

Card invariants:

- A card belongs to exactly 1 list
- Moving cards does not mutate card ID
- Archived cards remain queryable

---

### 5.6 Real-Time Collaboration

Transport:

- WebSocket
- Fallback: polling

Sync model:

- Event-based patch stream
- Server is authoritative

Conflict resolution:

- Last-write-wins for scalar fields
- Fractional index merge for ordering
- Activity events always append

Requirement:

No silent overwrites.

If conflict occurs:

- Client receives authoritative state
- UI reconciles automatically

---

### 5.7 Comments & Activity

Comments:

- Editable
- Soft-delete only
- Versioned

Activity log:

- Immutable append-only
- Includes actor, timestamp, diff metadata

Every mutation produces ≥ 1 activity event.

---

### 5.8 Attachments

Supported:

- File upload
- External URL

Rules:

- Upload is transactional
- Failure does not corrupt card state
- Metadata persists independently

Storage:

- Virus scanning recommended
- Signed URL access

---

## 6. Non-Functional Requirements

### Performance

- 1000-card board load < 2 seconds
- Drag frame budget ≤ 16ms
- Real-time propagation < 500ms

### Scalability

- Stateless API
- Horizontal scaling
- Shared event bus
- Sticky WebSocket sessions optional

### Reliability

- Offline mutation queue
- Replay after reconnect
- Idempotent server mutations

### Security

- RBAC server-side
- Rate limiting
- CSRF protection
- Input sanitization
- Secure file storage
- Audit logging

---

## 7. Data Model (Canonical)

### User

```
User {
  id: UUID
  email: string (unique)
  name: string
  avatar_url: string
  created_at: timestamp
}
```

### Workspace

```
Workspace {
  id: UUID
  name: string
  owner_id: UUID
  created_at: timestamp
}
```

### Membership

```
Membership {
  user_id: UUID
  workspace_id: UUID
  role: enum
}
```

### Board

```
Board {
  id: UUID
  workspace_id: UUID
  title: string
  state: enum(active, archived)
  created_at: timestamp
}
```

### List

```
List {
  id: UUID
  board_id: UUID
  title: string
  position: string
}
```

### Card

```
Card {
  id: UUID
  list_id: UUID
  title: string
  description: text
  position: string
  archived: boolean
  due_date: timestamp
}
```

### Comment

```
Comment {
  id: UUID
  card_id: UUID
  user_id: UUID
  content: text
  version: integer
  deleted: boolean
  created_at: timestamp
}
```

### Activity

```
Activity {
  id: UUID
  entity_type: string
  entity_id: UUID
  action: string
  actor_id: UUID
  payload: json
  timestamp: timestamp
}
```

---

## 8. API Requirements

### REST

All mutations are idempotent.

```
POST   /auth/login
POST   /workspaces
POST   /boards
GET    /boards/:id
POST   /cards
PATCH  /cards/:id
DELETE /cards/:id
```

Responses are JSON only.

Error envelope:

```
{
  "error": {
    "code": "string",
    "message": "human readable"
  }
}
```

---

### Real-Time Events

```
card_created
card_updated
card_moved
list_reordered
comment_added
member_joined
board_archived
```

Each event contains:

- entity id
- patch payload
- version number

---

## 9. Edge Case Handling

System must handle:

- Disconnect mid-drag → rollback + retry
- Concurrent edits → deterministic merge
- Large board rendering → virtualization
- Expired invites → graceful error
- Attachment failure → retry safe
- User removed mid-session → forced permission refresh

---

## 10. UI Requirements

- Virtualized lists & cards
- Keyboard accessible drag-drop
- Mobile responsive
- Optimistic UI with rollback
- Loading skeletons for large boards

---

## 11. Error Handling Rules

- No silent failures
- All API errors actionable
- UI reflects authoritative server state
- Failed optimistic mutation auto-reverts

---

## 12. Observability

Required telemetry:

- Mutation latency
- Sync delay
- Error rates
- Conflict rate
- WebSocket disconnects

All mutations logged with request ID.

---

## 13. Future Extensions

Architecture must support:

- Automation rules
- Plugin system
- AI suggestions
- Templates
- Reporting
- Offline-first mode

---

## 14. Acceptance Criteria

The system is acceptable when:

- All board mutations persist reliably
- Clients converge after conflicts
- Permission checks never bypassed
- UI remains responsive with 1000+ cards
- No silent corruption possible
- Activity log is complete and immutable
- Concurrent edits produce deterministic outcome

---
# Move this to design or architecture specification
## Design Architecture concern
Positions use fractional indexing (float or lexicographic string) to support concurrent insertions.

### Authorization Rules

- Server enforces RBAC on every mutation
- Client role state is advisory only
- Unauthorized mutation returns HTTP 403

## 1. System Overview

This system is a multi-tenant, real-time collaborative task management platform.

The application allows users to create workspaces containing boards composed of lists and cards. Multiple users can concurrently edit boards with deterministic conflict resolution and guaranteed persistence.

The system must behave predictably under concurrent edits, network interruptions, and partial failures.

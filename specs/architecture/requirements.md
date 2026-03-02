# Collaborative Kanban System — Engineering Specification

## 1. System Overview

This system is a multi-tenant, real-time collaborative Kanban board platform.

The application allows users to create workspaces containing boards composed of lists and cards. Multiple users can concurrently edit boards with deterministic conflict resolution and guaranteed persistence.

The system must behave predictably under concurrent edits, network interruptions, and partial failures.

---

## 2. System Guarantees

The system must guarantee:

1. Strong persistence  
   No acknowledged write is lost

2. Deterministic concurrency  
   All clients converge to identical board state

3. Event immutability  
   Activity log is append-only

4. Permission correctness  
   Server is the source of truth

5. Eventual real-time consistency  
   Clients converge within 1 second

6. UI rollback safety  
   Failed optimistic updates revert cleanly

---

## 3. Core Domain Model

Hierarchy:

```
Workspace
  └── Board
        └── List
              └── Card
```

All entities use UUID v7 or sortable IDs.

Positions use fractional indexing (float or lexicographic string) to support concurrent insertions.

---

## 4. Roles & Authorization

Roles are workspace-scoped.

### Roles

- Owner (immutable workspace owner)
- Admin
- Member
- Viewer

### Authorization Rules

- Server enforces RBAC on every mutation
- Client role state is advisory only
- Unauthorized mutation returns HTTP 403

---

## 5. Functional Requirements

### 5.1 Authentication

Supported methods:

- Email/password
- OAuth (Google, GitHub)

Requirements:

- Access tokens expire
- Refresh tokens rotate
- Sessions survive refresh
- Revoked tokens invalidate immediately

Failure behavior:

- Invalid token → forced logout
- Expired session → silent refresh attempt

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

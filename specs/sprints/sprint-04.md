# Sprint 03 — Workspace Lifecycle & RBAC

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §§4, 5.2](../architecture/requirements.md), [technical-decisions.md §§6, 9](../architecture/technical-decisions.md)

---

## Goal

Users can create workspaces, invite members, accept invitations, and have their roles enforced server-side on every subsequent request. RBAC is the security foundation all future sprints rely on.

---

## Scope

### 1. Data Model

New Prisma models (per [requirements §7](../architecture/requirements.md)):

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  createdAt DateTime @default(now())

  owner       User         @relation(fields: [ownerId], references: [id])
  memberships Membership[]
  boards      Board[]
  invites     Invite[]
}

model Membership {
  userId      String
  workspaceId String
  role        Role

  user      User      @relation(fields: [userId], references: [id])
  workspace Workspace @relation(fields: [workspaceId], references: [id])

  @@id([userId, workspaceId])
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

model Invite {
  id          String    @id @default(cuid())
  workspaceId String
  invitedEmail String
  token       String    @unique  // stored also in Redis with TTL
  role        Role      @default(MEMBER)
  acceptedAt  DateTime?
  expiresAt   DateTime
  createdAt   DateTime  @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}
```

Migration: `0003_workspace`

### 2. RBAC Middleware

Per [requirements §4](../architecture/requirements.md) — server is the authority:

```
server/middlewares/permissionManager.ts  (already exists in sample-project pattern)
  requireRole(minRole: Role)       -- attach after authentication.ts
  requireWorkspaceMembership()     -- resolves workspaceId from params/body
```

Role hierarchy: `OWNER > ADMIN > MEMBER > VIEWER`

RBAC rules (per [requirements §4](../architecture/requirements.md)):

| Action | Minimum Role |
|--------|-------------|
| Read board / list / card | VIEWER |
| Create / edit card | MEMBER |
| Manage lists, archive board | ADMIN |
| Invite / remove members | ADMIN |
| Delete workspace, change owner | OWNER |

Unauthorized → `HTTP 403`, error name `insufficient-role`

### 3. Server Extension

```
server/extensions/workspace/
  api/
    index.ts
    create.ts
    get.ts
    update.ts
    delete.ts
    invite/
      create.ts        # POST /api/v1/workspaces/:id/invite
      inspect.ts       # GET  /api/v1/invites/:token
      accept.ts        # POST /api/v1/invites/:token/accept
    members/
      list.ts          # GET  /api/v1/workspaces/:id/members
      updateRole.ts    # PATCH /api/v1/workspaces/:id/members/:userId
      remove.ts        # DELETE /api/v1/workspaces/:id/members/:userId
  common/
    config/
      invite.ts        # TTL from Bun.env (default 48 h)
  mods/
    invite/
      create.ts        # generate token, persist DB + Redis
      validate.ts      # check expiry + DB record
      consume.ts       # mark acceptedAt, create Membership
```

### 4. API Routes

| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| `POST` | `/api/v1/workspaces` | authenticated | Create workspace (caller becomes OWNER) |
| `GET` | `/api/v1/workspaces` | authenticated | List caller's workspaces |
| `GET` | `/api/v1/workspaces/:id` | VIEWER | Get workspace detail |
| `PATCH` | `/api/v1/workspaces/:id` | ADMIN | Rename workspace |
| `DELETE` | `/api/v1/workspaces/:id` | OWNER | Delete workspace |
| `POST` | `/api/v1/workspaces/:id/invite` | ADMIN | Send invite (stores token in Redis) |
| `GET` | `/api/v1/invites/:token` | — | Inspect invite (no auth required) |
| `POST` | `/api/v1/invites/:token/accept` | authenticated | Accept invite |
| `GET` | `/api/v1/workspaces/:id/members` | VIEWER | List members |
| `PATCH` | `/api/v1/workspaces/:id/members/:userId` | ADMIN | Change role |
| `DELETE` | `/api/v1/workspaces/:id/members/:userId` | ADMIN | Remove member |

### 5. Invariants

Per [requirements §5.2](../architecture/requirements.md):

- Workspace must always have ≥ 1 `OWNER`; removing/demoting the last owner returns `HTTP 409`, error name `workspace-must-have-owner`
- Invite token is single-use: `acceptedAt` must be `null`
- Expired invite token returns `HTTP 410`, error name `invite-expired`
- Redis key `invite:<token>` checked first (fast path); DB checked as fallback

### 6. Frontend Extension

```
src/extensions/Workspace/
  components/
    WorkspaceSwitcher.tsx
    InviteMemberModal.tsx
    MemberList.tsx
    RoleBadge.tsx
  containers/
    WorkspacePage/
      WorkspacePage.tsx
      WorkspacePage.duck.ts
    AcceptInvitePage/
      AcceptInvitePage.tsx
  api.ts
  routes.ts
  translations/
    en.json
```

---

## Error Responses

| Name | HTTP | Trigger |
|------|------|---------|
| `workspace-not-found` | 404 | Invalid workspace ID |
| `insufficient-role` | 403 | Caller lacks required role |
| `invite-expired` | 410 | Invite TTL exceeded |
| `invite-already-used` | 409 | Token already accepted |
| `workspace-must-have-owner` | 409 | Last owner removal attempt |
| `member-not-found` | 404 | Target user not in workspace |

---

## Tests

- Unit: invite token generation + validation, role comparison helper
- Integration: create workspace, full invite → accept flow, RBAC enforcement on each route, owner invariant

---

## Acceptance Criteria

- [ ] User can create a workspace and is automatically OWNER
- [ ] ADMIN can send invite; invite link expires after 48 h (default)
- [ ] Accepting expired invite returns HTTP 410
- [ ] Single-use: second `accept` on same token returns 409
- [ ] VIEWER cannot invite or remove members (403)
- [ ] Removing the last OWNER returns 409
- [ ] `GET /api/v1/invites/:token` works without authentication

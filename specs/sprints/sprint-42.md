# Sprint 42 — Split AWS Credentials: LocalStack S3 vs Real AWS SES

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 12 (S3 attachment infra), Sprint 23 (SES email module)  
> **References:** [requirements §3 — Auth / Attachments](../architecture/requirements.md)

---

## Goal

`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are currently shared by both the S3 client (which uses LocalStack dummy credentials `test`/`test` in dev) and the SES client (which needs **real** AWS credentials). This makes it impossible to run SES against real AWS while S3 points at LocalStack in the same environment.

Introduce dedicated `S3_AWS_ACCESS_KEY_ID` / `S3_AWS_SECRET_ACCESS_KEY` env vars for S3 / LocalStack. The SES client continues to use the top-level `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. Each client resolves its own credentials independently with a clear fallback chain.

---

## Credential Resolution Rules

### S3 Client

```
S3_AWS_ACCESS_KEY_ID     → use if set (LocalStack dev or dedicated S3 IAM key)
AWS_ACCESS_KEY_ID        → fallback (shared key — backward compatible)
```

Same rule applies to `S3_AWS_SECRET_ACCESS_KEY` → `AWS_SECRET_ACCESS_KEY`.

### SES Client

```
AWS_ACCESS_KEY_ID        → always (these are the real AWS credentials)
AWS_SECRET_ACCESS_KEY    → always
```

This means:
- **Local dev** sets `S3_AWS_ACCESS_KEY_ID=test` + `S3_AWS_SECRET_ACCESS_KEY=test` (LocalStack) and leaves `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` blank or set to real creds for SES.
- **Production** with a single AWS account can omit the `S3_AWS_*` vars entirely and the fallback to `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` keeps existing behaviour.

---

## Scope

### 1. `server/config/env.ts`

Add two new env vars:

```typescript
// S3-specific credentials (LocalStack in dev, or a dedicated S3 IAM key).
// Falls back to AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY when not set.
S3_AWS_ACCESS_KEY_ID: Bun.env['S3_AWS_ACCESS_KEY_ID'] ?? '',
S3_AWS_SECRET_ACCESS_KEY: Bun.env['S3_AWS_SECRET_ACCESS_KEY'] ?? '',
```

---

### 2. `server/extensions/attachment/common/config/s3.ts`

Update the S3Client credentials to use the dedicated vars with fallback:

```typescript
credentials: {
  accessKeyId: env.S3_AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.S3_AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY,
},
```

No change to any other part of the S3 config (`endpoint`, `region`, `forcePathStyle`).

---

### 3. `server/extensions/email/mods/ses.ts`

**No change required.** SES already uses `env.AWS_ACCESS_KEY_ID` / `env.AWS_SECRET_ACCESS_KEY` — those remain the real-AWS credential vars.

Confirm with a code comment that this is intentional:

```typescript
// Intentionally uses the top-level AWS credentials, not S3_AWS_* vars.
// S3 has its own dedicated credential vars to support LocalStack in dev.
```

---

### 4. `.env` (dev defaults)

Split the S3 block to make the separation explicit:

```dotenv
# ── Storage (LocalStack S3 via docker-compose) ─────────────────────────────────
S3_ENDPOINT=http://localhost:4566
S3_BUCKET=kanban
S3_REGION=us-east-1
# LocalStack uses dummy credentials — these are S3-specific and do NOT apply to SES.
S3_AWS_ACCESS_KEY_ID=test
S3_AWS_SECRET_ACCESS_KEY=test

# ── AWS (real credentials — used by SES and any non-LocalStack AWS services) ────
# Leave blank in local dev unless FLAG_SES_ENABLED=true pointing at real AWS.
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Remove the old `AWS_ACCESS_KEY_ID=test` / `AWS_SECRET_ACCESS_KEY=test` lines that were in the S3 block.

---

### 5. `.env.example`

Update the S3 section comment and add `S3_AWS_ACCESS_KEY_ID` / `S3_AWS_SECRET_ACCESS_KEY`:

```dotenv
# S3 / file storage
# When FLAG_USE_LOCAL_STORAGE=true (default in dev), S3 points at LocalStack.
# Use S3_AWS_* for LocalStack / dedicated S3 IAM keys — they fall back to the
# global AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY when not set.
S3_BUCKET=kanban
S3_REGION=us-east-1
S3_ENDPOINT=                       # leave blank for real AWS S3; set to http://localhost:4566 for LocalStack
S3_AWS_ACCESS_KEY_ID=              # LocalStack: test | production: leave blank to inherit AWS_ACCESS_KEY_ID
S3_AWS_SECRET_ACCESS_KEY=          # LocalStack: test | production: leave blank to inherit AWS_SECRET_ACCESS_KEY

# AWS credentials — used by SES and as fallback for S3 when S3_AWS_* vars are unset.
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Remove the old comment `# AWS credentials are shared with S3 (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY above)` from the SES section and replace it with:

```dotenv
# AWS SES — requires real AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY above).
# S3 / LocalStack uses its own S3_AWS_* vars so the two credential sets never collide.
```

---

## Credential Matrix

| Service | Env var used | Dev value | Prod value |
|---------|-------------|-----------|-----------|
| S3 / LocalStack | `S3_AWS_ACCESS_KEY_ID` → fallback `AWS_ACCESS_KEY_ID` | `test` | real IAM key (or blank to use global) |
| SES (real AWS) | `AWS_ACCESS_KEY_ID` | blank (SES off in dev) | real IAM key |

---

## Acceptance Criteria

- [ ] Dev (`FLAG_USE_LOCAL_STORAGE=true`, `FLAG_SES_ENABLED=false`): file uploads reach LocalStack with `test`/`test`; no AWS call made for email
- [ ] Dev (`FLAG_USE_LOCAL_STORAGE=true`, `FLAG_SES_ENABLED=true`): S3 still uses `S3_AWS_ACCESS_KEY_ID=test`; SES uses real `AWS_ACCESS_KEY_ID` — the two credential sets do not collide
- [ ] Prod (`S3_AWS_*` vars unset): S3 client falls back to `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — no regressions
- [ ] `server/config/env.ts` is the only place `S3_AWS_ACCESS_KEY_ID` / `S3_AWS_SECRET_ACCESS_KEY` are read from `Bun.env`
- [ ] `.env` no longer has `AWS_ACCESS_KEY_ID=test` in the S3 block
- [ ] `.env.example` clearly documents both credential sets and their fallback behaviour
- [ ] SES client has a comment confirming it intentionally uses the global `AWS_*` vars

---

## Tests

```
specs/tests/
  aws-credential-split.md    # Unit: S3 client picks S3_AWS_ACCESS_KEY_ID when set; falls back when unset
```

---

## Files

```
server/config/env.ts                                      (updated — add S3_AWS_ACCESS_KEY_ID, S3_AWS_SECRET_ACCESS_KEY)
server/extensions/attachment/common/config/s3.ts          (updated — use S3_AWS_* || AWS_* fallback)
server/extensions/email/mods/ses.ts                       (comment only — clarify intentional use of global creds)
.env                                                      (updated — split S3 and AWS cred blocks)
.env.example                                              (updated — document both credential sets)
```

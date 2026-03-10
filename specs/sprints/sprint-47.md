# Sprint 47 — UUID v7 Migration

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 01 (Project Setup)  
> **References:** [requirements §6 — NFR-11](../architecture/requirements.md)

---

## Goal

The requirements specification mandates UUID v7 (time-sortable) for all entity identifiers (U-NFR-11). Currently the entire codebase uses `uuidv4()` from the `uuid` package. This sprint replaces every `uuidv4()` call with `uuidv7()` and updates the Knex default value helpers so all new rows automatically receive a UUID v7 primary key.

No database column types change — keys remain `uuid` / `varchar(36)`. Only the _generator_ changes, making IDs chronologically sortable for free, which improves index locality and range queries.

---

## Why UUID v7

- Time-ordered: lexicographic sort ≈ insertion order — no separate `created_at`-based sort needed for most list queries
- Globally unique without coordination
- Readable timestamp embedded in the first 48 bits (millisecond precision)
- Drop-in replacement for UUID v4 — same 36-character string format

---

## Scope

### 1. `package.json` — verify `uuid` version

The `uuid` package has exported `v7` since **v9.0.0**. Confirm the installed version supports it; upgrade if necessary.

```bash
bun add uuid@^9
bun add -d @types/uuid
```

---

### 2. `server/common/uuid.ts` (new)

Centralise the generator so future changes only touch one file:

```ts
import { v7 as uuidv7 } from 'uuid';

export const generateId = (): string => uuidv7();
```

---

### 3. Replace all `uuidv4()` call sites

Search for every import and usage of `uuidv4` / `v4 as uuid` across:

- `server/extensions/**/` — entity creation helpers, seeding
- `server/mods/**/` — token generation (refresh tokens, email verification tokens, etc.)
- `db/seeds/` — seed data generators

Replace each with `generateId()` from `server/common/uuid.ts`.

> **Note:** Cryptographic tokens (password reset, email verification, invite tokens) that are used as opaque secrets should **not** use UUID v7 — they require random entropy, not time-sortability. Keep those as `crypto.randomBytes(32).toString('hex')` or equivalent. UUID v7 replacement applies only to _entity primary keys_.

---

### 4. Knex default value helper (optional, additive)

If the project uses a shared Knex table builder helper that sets `table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))`, note that `gen_random_uuid()` generates UUID v4 at the Postgres level. Either:

a. Remove the DB-level default and always generate the ID in application code (recommended — keeps generator behaviour consistent regardless of DB driver), or  
b. Replace with a Postgres `uuid_generate_v7()` extension function if available.

Option (a) is preferred: generate IDs in `generateId()` before insert, never rely on DB default for primary keys.

---

## Acceptance Criteria

- [ ] `uuidv4` is no longer imported anywhere in `server/` or `db/`
- [ ] All new entity records receive a UUID v7 key (time-ordered)
- [ ] Cryptographic tokens (reset, verification, invite) remain as random hex strings — NOT UUID v7
- [ ] Existing integration tests pass without modification (UUID format is still a valid 36-char string)
- [ ] `generateId()` is the single import point for entity ID generation across the codebase

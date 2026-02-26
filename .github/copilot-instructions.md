# Copilot Workflow Instructions

## Core Principles

**Context sources (in order of priority):**
1. `specs/` — single source of truth (architecture, requirements, changelogs)
2. `./sample-project/` — read-only reference, never modify or run
3. **For complex tasks**: read 3 latest `specs/changelog/*.md` files

**Group by feature, not type.** Each feature = own subtree + own git repo.
Naming: `sharetribe-horizon-extensions-<name-separated-by-dash>`

---

## Folder Structure

### Client code

Group by feature under `src/extensions/<FeatureName>/`.

Example — Voucher / Discount feature:

```
.
├── src/
│   └── extensions/
│       └── Voucher/
│           ├── config/
│           │   ├── configA.js
│           │   └── configB.js
│           ├── components/
│           │   └── VoucherInputField.js
│           ├── containers/
│           │   └── EditVoucherPage/
│           │       ├── EditVoucherPage.js
│           │       └── EditVoucherPage.duck.js
│           ├── translations/
│           │   └── en.json
│           ├── validators.js
│           ├── routes.js
│           ├── reducers.js
│           ├── types.js
│           ├── api.js
│           └── README.md
```

### Server code

Group by feature under `server/extensions/<featureName>/`.

Example — Voucher / Discount feature (Voucherify integration):

```
.
└── server/
    └── extensions/
        ├── common/
        └── discount/
            ├── api/
            │   ├── index.js
            │   ├── get.js
            │   └── create/
            │       └── index.js
            ├── common/
            │   └── config/
            │       ├── stripe.js
            │       └── voucherify.js
            ├── middlewares/
            │   └── authentication.js
            └── mods/
                └── voucherify/
                    ├── customer/
                    │   ├── create.js
                    │   └── get.js
                    ├── voucher/
                    │   ├── get.js
                    │   └── create/
                    │       └── index.js
                    └── instance.js
```

### Common code

**Common:** `src/common/` (client) or `server/common/` (server) — shared between 2+ features. Start in feature folder, migrate to common when needed.

---

## Working Guidelines

**Before coding:**
1. **For complex tasks**: read 3 latest `specs/changelog/*.md` + `specs/architecture/*.md`
2. **If uncertain**: consult `specs/` (single source of truth)
3. Check `./sample-project/` for reference patterns (read-only, never modify)

**When implementing:**
- Design before coding (outline steps first)
- Keep scope small: 1-2 features max per iteration
- Add `// [context]` comments explaining *why*
- New user flows → create test in `specs/tests/`
- Commits: `feat|fix|chore(<scope>): <summary>`

**After changes:**
- Write changelog to `specs/changelog/YYYYMMDD_HHMMSS.md` with 4 sections (Update, New, Technical Debt, What Should Be Done Next) — skip for trivial edits
- Test if UI/API/auth changed or 3+ files touched
- State explicitly if testing/changelog skipped and why

---

## General Rules

- `./sample-project/` is read-only — never modify or run
- Write changelog for meaningful changes (skip trivial edits)
- Test scenarios mandatory for new flows
- Keep iterations small
- Comments explain *why*, not *what*

---

## Coding Conventions

### API Endpoints

#### Method usage

Use the correct HTTP method for each action — do not label everything `POST`.

| Method | Purpose |
|--------|---------|
| `GET` | Retrieve resources. Extra config via query params. |
| `POST` | Create resources only. |
| `PUT` | Replace an entire existing resource. |
| `PATCH` | Partially update an existing resource. |
| `DELETE` | Delete resources. Must be accompanied by authentication. |

#### Naming

Split endpoints into resource chunks. Use the HTTP method to express the action — the trailing segment should be one word. More than two words is a signal to split further.

✅
```
POST   /api/user       → create user
PUT    /api/user       → replace user
PATCH  /api/user       → partial update user
DELETE /api/user       → delete user
```

❌
```
POST /api/createUser
POST /api/updateUser
```

#### Handling errors

Every error response must follow this shape:

```ts
interface Error {
  name: string; // words separated by hyphens, e.g. 'current-user-is-not-admin'
  data?: any;
}
```

✅
```js
return { name: 'current-user-is-not-admin', data: { message: '...' } }
```

❌
```js
// Missing name
return { data: { message: '...' } }
// Plain word instead of hyphenated
return { name: 'forbidden', data: { message: '...' } }
```

#### Handling response

##### Single entity
```ts
interface Response { data: Object; }
```
✅ `return { data: { id: 1, name: 'foo' } }` / `return { data: {} }`  
❌ `return null` / `return { id: 1 }` / nested `data.data`

##### Array of entities
```ts
interface Response { data: Array; }
```
✅ `return { data: [...] }` / `return { data: [] }`  
❌ `return [...]` / nested `data.data`

##### Creation / update
Always return the freshly persisted resource from the DB — never the stale pre-update object.

##### Query (paginated / cursor)
```ts
interface Response {
  data: Array;
  metadata: {
    totalPage?: number; perPage?: number;   // pagination
    cursor?: any;       hasMore?: boolean;  // cursor
  };
}
```
Metadata must be nested under `metadata` — never at the top level alongside `data`.

##### Entity with related includes
```ts
interface Response {
  data: Object;
  includes: { [EntityType]: object | array };
}
```
Every key inside `includes` must belong to a named entity type. Bare primitive fields are not allowed inside `includes`.

---

### Code Modules

#### Priorities

1. Readability
2. Reusability
3. Configurable
4. Performance
5. Security
6. Shortness

#### Naming

Outer (top-level) modules are named as **nouns** (entities).

✅ `paypal/`, `stripe/`, `venmo/`  
❌ `handlingPaypal/`, `createStripe/`

Inner functions may use verbs: `fetchData`, `workingOnFoo`, etc.

#### Input

Each module has a single entry point (`index.js` for Node, `mod.ts` for Deno).  
Always accept arguments as a **single destructured object** — never positional params.

✅
```js
const query = ({ page, totalPage }) => { ... }
```
❌
```js
const query = (page, totalPage) => { ... }
```

#### Output

Module responses mirror the API response shape but always include a `status` field.

✅
```js
return { status: 200, data: { id: 1 }, includes: { listings: [...] } }
return { status: 403, name: 'forbidden', data: { message: '...' } }
```
❌
```js
// Missing status
return { data: { id: 1 } }
```

#### Composing

Favour functional composition over large imperative blocks. The `index` file should *describe* what the module does, not *instruct* step by step.

✅
```js
const handlingPayment = composePromises(
  fetchTransaction,
  validateTransaction,
  createStripeParams,
  stripe.order.create,
  normaliseResponse,
)(paymentParams)
```
❌ One big async function doing all of the above inline.

#### Comments

Mark intentional shortcuts with `TODO` so the next developer knows what needs to be cleaned up.

✅ `// TODO: split this into smaller functions`  
❌ `// This should be split...` (no `TODO` prefix — easy to overlook)

#### Environments

Never access `process.env` directly outside of a dedicated `config` module. All environment variables must be centralised there so the full set of env vars used by the project is visible in one place.

#### Runtime

This project runs on **[Bun](https://bun.sh/)**.

- Bun executes both `.js` and `.ts` files natively — no build step or transpilation is required.
- **Always use Bun as the runtime** for all server-side scripts and entry points.
- Script shebang lines must use `#!/usr/bin/env bun`, not `node`.
- Module entry points should be `.ts` by preference; `.js` is acceptable when typing adds no value (e.g. trivial config files).
- Use Bun's built-in APIs (`Bun.file`, `Bun.serve`, `Bun.env`, etc.) instead of Node.js equivalents where a Bun-native API exists.
- `Bun.env` is the preferred way to access environment variables inside the `config` module — do not use `process.env` directly anywhere else.
- Package management uses `bun install` / `bun add` — never `npm install` or `yarn add`.

---

### Security

#### Authentication

1. Never expose secrets to clients unless required for a public SDK — and even then, scope access to the minimum required.
2. **Deny first, allow later.** Design every system assuming all access is denied and open it up incrementally.
3. Prefer a single identity/auth provider over multiple parallel systems to avoid out-of-sync data.  
   _e.g. Re-use Sharetribe Flex's auth system rather than building a separate login layer._
4. Always verify the caller's identity before executing any logic.

#### Data

1. `GET` endpoints must return only what was explicitly requested — no extra fields.

#### Do and Do not

_(This section will be updated regularly as new patterns are identified.)_

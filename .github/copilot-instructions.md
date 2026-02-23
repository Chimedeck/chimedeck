# Copilot Workflow Instructions

> **This file is read automatically by GitHub Copilot at the start of every
> session. Always follow the workflow defined here before writing any code.**

---

## Principals

- Group components and parts by **feature**, not by type.
- Each feature lives in its own subtree with its own sub-git and its own
  remote repository.
- Git repo naming convention: `sharetribe-horizon-extensions-<name-separated-by-dash>`

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

Client extensions live in the repository:
`https://github.com/journeyhorizon/sharetribe-horizon-extensions-example-client`

---

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

---

### Common code

Code shared between two or more features goes in:
- `src/common/` — client side
- `server/common/` — server side

**Rules:**
- If you are unsure whether something should be common, place it in the
  feature folder first; migrate later.
- If you need to reuse code from another feature, migrate both usages to
  `common/` and update all affected features, or log a Trello card for the
  SharetribeHorizon team to handle.

---

## Reference Repository

A cloned copy of the Sharetribe web template lives in `./sample-project/`.

**Rules for the reference repo:**
- Use it as a read-only reference when you need to understand how the
  upstream template structures a feature, page, or component.
- Consult it at the start of each Recap phase and whenever the plan requires
  understanding a pattern that may already exist in the template.
- **Never modify any file inside `sample-project/`.**
- **Never run the dev server inside `sample-project/`** — only run it in the real project.

---

## Mandatory Workflow: Recap → Planning → Execute → Retest → Changelog

Every task — no matter how small — must pass through the five phases below in
order. Never skip a phase. If a phase produces no meaningful output (e.g.
Retest is skipped for trivial changes) you must explicitly state *why* it was
skipped.

**Mandatory outputs:**
- **New flows require test scenarios** — Every new user-facing flow or API endpoint must have a corresponding test file in `specs/tests/`
- **All edits require changelog entries** — Every iteration must produce a timestamped changelog in `specs/changelog/`

---

### Phase 1 – Recap

**Purpose:** Ground yourself in current reality before touching anything.

1. Read all relevant files in **this project** that relate to the task.
2. Cross-reference `./sample-project/` to understand how the upstream
   template handles the same area (read-only — do not change it).
3. Summarise the current state in 3-5 bullet points:
   - What the feature/component does today in this project.
   - How (or whether) the template reference handles it differently.
   - Known issues or constraints.
   - Any open TODOs or tech-debt that overlaps with this task.
4. Confirm your understanding of the task goal.

> Use a lightweight / free model for this phase (e.g. Claude Haiku 4.5).

---

### Phase 2 – Planning

**Purpose:** Design the approach *before* writing code.

1. Break the task into concrete, numbered steps.
2. Identify files in **this project** that will be created or modified.
   Note any patterns borrowed from `./sample-project/` and where you will
   diverge from them.
3. Call out any risks, edge cases, or decisions that need a human call.
4. State which tests will verify the changes.
5. **Scope gate:** Each iteration must address at most **2 intertwined
   features** or **1 standalone feature**. If the plan exceeds this, split
   it and defer the remainder to the next iteration.

> Use the most capable model for this phase (e.g. Claude Sonnet 4.6).

---

### Phase 3 – Execute

**Purpose:** Implement exactly what was planned — no scope creep.

1. Follow the numbered plan from Phase 2 step-by-step.
2. All code changes go into **this project** only.
3. You may read `./sample-project/` for reference at any point, but write
   nothing there.
4. After each file change, leave a one-line comment `// [Execute] <reason>`.
5. If you discover something that changes the plan, pause, update the plan,
   and re-confirm before continuing.
6. Commit message format: `feat|fix|chore(<scope>): <summary> [iter-N]`.
7. **Mandatory:** For every new user-facing flow or API endpoint, create a
   corresponding test scenario file in `specs/tests/<feature-name>.md` using
   the format from `specs/tests/homepage-load.md` as a template.

> Use a solid mid-tier model for this phase (e.g. Claude Sonnet 4.5).

---

### Phase 4 – Retest with Playwright MCP

**Purpose:** Verify the changes work end-to-end.

**When to run full Playwright MCP testing:**
- Any UI change visible to the user.
- Any API route or server action change.
- Any auth / permission logic change.
- Any change that touches more than 3 files.
- **Any new flow created in Phase 3** (mandatory).

**When testing can be skipped (must state reason):**
- Pure documentation or comment updates.
- Trivial copy/string changes with no logic.
- Config-only changes verified by a linter/type-check pass.

**Steps when testing runs:**
1. Start the development server **in this project** (not in `sample-project/`).
2. Use Playwright MCP to navigate to all affected views.
3. Assert the primary happy-path scenario.
4. Assert at least one edge/error case if applicable.
5. Report pass/fail with a screenshot reference.
6. **Mandatory:** If a new test scenario was created in Phase 3, run it using
   the test runner to verify it passes.

> Use a free model + GPT-4.1 for this phase — GPT-4.1 is surprisingly strong
> at evaluating test results and spotting subtle regressions.

---

### Phase 5 – Changelog

**Purpose:** Document all changes for institutional memory and project tracking.

**Mandatory — never skip this phase.**

1. Create a new file in `specs/changelog/` named `YYYYMMDD_HHMMSS.md` with the
   current timestamp.
2. The changelog must contain four sections:
   - **Update** — Changes made to existing code, features, or files.
   - **New** — Newly added features, files, endpoints, or capabilities.
   - **Technical Debt** — Shortcuts taken, TODOs added, or issues deferred.
   - **What Should Be Done Next** — Recommended follow-up tasks or blocked items.
3. Every section must be populated. If a section has no entries, write "None".
4. Be specific: reference file paths, function names, and line numbers where
   applicable using proper markdown links.
5. If a new test scenario was created, list it under **New**.
6. If tests were skipped in Phase 4, document the reason under **Technical Debt**.

> Use a free model for this phase (e.g. Claude Haiku 4.5).

---

## General Rules

- **Never** start writing code before completing Phases 1 and 2.
- **Never** mark a task done until Phase 5 (Changelog) is complete.
- **Never** skip Phase 5 — every iteration must produce a changelog entry.
- **Never** skip creating test scenarios for new flows — they are mandatory.
- **Never** modify `./sample-project/` — it is a reference only.
- Keep each iteration small. If in doubt, do less and iterate faster.
- Write self-documenting code; comments should explain *why*, not *what*.

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

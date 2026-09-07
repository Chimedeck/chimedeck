# plugin-data-cross-board-isolation-break

## Serveriy (Critical, High, Medium, Low, Warning)

High

## Explainnation on the impact

If plugin data authorization checks trust only `(plugin_id, scope, resource_id, visibility, key)` and do not verify that `resource_id` belongs to a board the caller can access, a plugin context on Board A can read or overwrite plugin data from Board B. This is a cross-board isolation failure with multi-tenant impact: confidentiality loss (foreign plugin state disclosure), integrity loss (cross-board value tampering), and availability risk (plugin workflows break due to poisoned state).

Requirement/spec mapping: this conflicts with access guarantees in `specs/architecture/requirements.md` (guests and members only access granted boards), multi-tenant boundaries in `specs/architecture/architecture.md` (permission correctness and board visibility rules), and scoped plugin storage behavior in `specs/architecture/plugins.md` (`t.get`/`t.set` bound to resource context and visibility semantics).

## How to actually exploit the loop hole

1. Enable the same plugin on two different boards (Board A and Board B) under different access contexts.
2. As a Board A member, capture plugin SDK/API traffic for `t.get`/`t.set` or `/api/plugins/data`.
3. Replace `resourceId` (or equivalent scoped identifier) in the request with a resource from Board B.
4. Replay read requests first; then attempt write requests using the same `plugin_id`/`api_key` and substituted foreign resource identifiers.
5. Observe whether Board B plugin values are returned, updated, or if error differences still confirm foreign resource existence.

## Step by step hypothesis to re-produce the loop whole

1. Create Workspace A and Workspace B with no shared users, then create one board in each workspace.
2. Enable the same plugin on both boards and store distinct marker values in Workspace B at `board`, `list`, and `card` plugin-data scopes.
3. Sign in as a user who can access Workspace A board only.
4. From the Workspace A board context, intercept one legitimate plugin data read call (`t.get` path or plugin data API).
5. Replace its `resourceId` (and any related scoped identifier fields) with Workspace B resource IDs and replay.
6. Confirm leakage if the response returns Workspace B marker values, metadata, or non-uniform errors indicating object existence.
7. Repeat using write/update calls (`t.set` or equivalent API) with the same foreign IDs.
8. Confirm integrity break if Workspace B marker values are changed from Workspace A context, then log affected scopes, visibility modes (`shared`/`private`), and endpoint variants.

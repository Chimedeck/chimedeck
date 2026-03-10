# Sprint 51 — Auth Hardening & WebSocket Polling Fallback

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 09 (Real-Time Infrastructure), Sprint 20 (Real-Time UI)  
> **References:** [requirements §3 — Auth, §5.6 — Real-Time](../architecture/requirements.md)

---

## Goal

Four auth and real-time reliability gaps are closed in this sprint:

1. **Access token TTL** — currently 15 minutes (dev convenience); requirements specify 24 hours
2. **WS session termination on token revocation** — logging out or revoking a token should immediately close the user's active WebSocket connections
3. **Client-side forced logout** — when an API call returns `401` mid-session the client must clear state and redirect to login rather than silently failing
4. **WebSocket polling fallback** — when WebSocket is unavailable (corporate firewall, unsupported environment) the client should fall back to HTTP polling

---

## Scope

### 1. Access Token TTL — `server/config/env.ts`

```ts
// Change from 15 * 60 to 24 * 60 * 60
ACCESS_TOKEN_TTL_SECONDS: Number(Bun.env['ACCESS_TOKEN_TTL_SECONDS'] ?? 24 * 60 * 60),
```

This is configurable via env var for test environments that need shorter TTLs.

---

### 2. WS Session Termination on Token Revocation

When a user's refresh token is revoked (logout, password change, admin revoke), the server must push a disconnect signal to any live WebSocket connections belonging to that user.

#### Server-side

In `server/extensions/auth/` — after marking a token as revoked:

```ts
// Publish a 'session_revoked' internal event keyed by userId
pubSub.publish(`session:${userId}`, { type: 'session_revoked' });
```

In the WebSocket connection handler (`server/mods/realtime/` or equivalent):

```ts
// On 'session_revoked' for this userId, close the WS with code 4001
ws.close(4001, 'session_revoked');
```

---

### 3. Client-Side Forced Logout (`src/`)

In the RTK Query `baseQuery` or Axios interceptor, add a `401` interceptor:

```ts
if (response.status === 401) {
  // Clear auth state
  dispatch(logout());          // clear Redux auth slice
  // Remove persisted tokens
  localStorage.removeItem('refreshToken');
  // Redirect to login
  window.location.href = '/login?reason=session_expired';
}
```

The WebSocket client must also handle close code `4001`:

```ts
ws.onclose = (event) => {
  if (event.code === 4001) {
    dispatch(logout());
    window.location.href = '/login?reason=session_revoked';
  }
};
```

---

### 4. HTTP Polling Fallback

When the initial WebSocket connection fails (after 3 attempts with exponential backoff), the real-time client must switch to HTTP polling.

#### Polling strategy

- Poll `GET /api/v1/boards/:id/events?since=<lastSequence>` every **5 seconds**
- On reconnect attempt success, switch back to WebSocket and stop polling
- Display a subtle indicator in the UI (e.g. "⟳ Live updates unavailable — polling") when in fallback mode

#### Server-side polling endpoint

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/boards/:id/events` | Returns events with `sequence > since` query param; max 100 events per call |

Query params: `since` (integer, required), `limit` (integer, default 100, max 100).

Response:
```json
{
  "data": [{ "type": "...", "version": 1, "entityId": "...", "payload": {} }],
  "metadata": { "hasMore": false, "latestSequence": 42 }
}
```

---

## Acceptance Criteria

- [ ] `ACCESS_TOKEN_TTL_SECONDS` defaults to 86400 (24h); configurable via env var
- [ ] Logging out revokes the token and closes the user's active WS connections with code 4001
- [ ] Client receiving close code 4001 clears auth state and redirects to `/login?reason=session_revoked`
- [ ] API returning `401` mid-session triggers the same logout + redirect flow
- [ ] After 3 failed WS connection attempts the client falls back to polling `GET /boards/:id/events`
- [ ] Polling fallback indicator is visible in the UI
- [ ] When WS reconnects successfully polling stops

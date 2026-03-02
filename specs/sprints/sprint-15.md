# Sprint 15 — UI Foundation

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 02 (build tooling), Sprint 03 (auth API)  
> **References:** [requirements §§3, 5](../architecture/requirements.md), [technical-decisions.md](../architecture/technical-decisions.md)

---

## Goal

Establish the complete frontend scaffolding: Vite + React + TypeScript build pipeline, React Router v6 routing shell, Redux Toolkit store, a typed API client, and a `PrivateRoute` guard that redirects unauthenticated users to `/login`.

---

## Scope

### 1. Package Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "@reduxjs/toolkit": "^2",
    "react-redux": "^9",
    "axios": "^1",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "class-variance-authority": "^0.7",
    "@radix-ui/react-dialog": "^1",
    "@radix-ui/react-dropdown-menu": "^2",
    "@radix-ui/react-tooltip": "^1",
    "@radix-ui/react-avatar": "^1",
    "lucide-react": "^0.400"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10",
    "@types/react": "^18",
    "@types/react-dom": "^18"
  }
}
```

**Design system approach:** Tailwind CSS utility-first with shadcn/ui-inspired component primitives.  
All components use `clsx` + `tailwind-merge` (`cn()` helper) for conditional class composition. No separate CSS files — all styling via Tailwind classes.

```ts
// src/common/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```
```

### 2. Vite Configuration

```
vite.config.ts            # React plugin, proxy /api → :3000, alias @/ → src/
tailwind.config.ts
postcss.config.js
src/
  main.tsx                # React root — ReactDOM.createRoot
  App.tsx                 # Router + Provider wrapper
  index.css               # Tailwind base/components/utilities
```

`vite.config.ts` — key settings:
- `server.proxy`: `/api` proxied to `http://localhost:3000` (avoids CORS in dev)
- `resolve.alias`: `@` → `src/`

### 3. Routing Shell

```
src/
  routing/
    index.tsx             # <BrowserRouter> + route definitions
    PrivateRoute.tsx      # redirects to /login if no valid access token
    PublicRoute.tsx       # redirects to /workspaces if already logged in
  pages/
    NotFoundPage.tsx      # 404 catch-all
```

Route table (all pages are lazy-loaded via `React.lazy`):

| Path | Component | Auth |
|------|-----------|------|
| `/login` | `LoginPage` | Public only |
| `/signup` | `SignupPage` | Public only |
| `/workspaces` | `WorkspacesPage` | Private |
| `/workspaces/:workspaceId/boards` | `BoardsPage` | Private |
| `/boards/:boardId` | `BoardPage` | Private |
| `*` | `NotFoundPage` | — |

### 4. Redux Store

```
src/
  store/
    index.ts              # configureStore — root reducer
  slices/
    authSlice.ts          # { user, accessToken, status }
    uiSlice.ts            # { theme, sidebarOpen, activeModal }
```

`authSlice` state shape:
```ts
interface AuthState {
  user: { id: string; name: string; email: string; avatarUrl?: string } | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
}
```

### 5. API Client

```
src/
  common/
    api/
      client.ts           # axios instance — baseURL /api/v1, auto-attach Bearer token
      interceptors.ts     # 401 → dispatch logout + redirect /login
```

`client.ts`:
- `baseURL: '/api/v1'`
- Request interceptor: read `accessToken` from Redux store, attach as `Authorization: Bearer <token>`
- Response interceptor: on `401`, call `POST /api/v1/auth/refresh`; if refresh fails, dispatch `logout`

### 6. File Structure

```
src/
  App.tsx
  main.tsx
  index.css
  common/
    api/
      client.ts
      interceptors.ts
    components/
      Spinner.tsx         # generic loading spinner
      ErrorBoundary.tsx   # React error boundary with fallback UI
      Button.tsx          # base button (primary | ghost | danger variants)
      Input.tsx           # base controlled input
  routing/
    index.tsx
    PrivateRoute.tsx
    PublicRoute.tsx
  pages/
    NotFoundPage.tsx
  store/
    index.ts
  slices/
    authSlice.ts
    uiSlice.ts
```

### 7. Acceptance Criteria

- [ ] `bun run dev:client` starts Vite on port 5173 without errors
- [ ] Visiting `http://localhost:5173/workspaces` redirects to `/login` when no token is in the store
- [ ] Visiting `/login` when already authenticated redirects to `/workspaces`
- [ ] `GET /api/v1/health` proxied through Vite returns `{ status: "ok" }` in browser network tab
- [ ] Tailwind utility classes are available in all `.tsx` files
- [ ] `NotFoundPage` is shown for unknown routes
- [ ] TypeScript compiles without `any` errors (`bun run typecheck`)

### 8. Tests

```
tests/integration/
  ui-routing.test.ts      # PrivateRoute redirect logic (unit, no browser)
specs/tests/
  ui-foundation.md        # Playwright: navigate to /login, check page title
```

`specs/tests/ui-foundation.md` test steps:
1. Open `http://localhost:5173` — expect redirect to `/login`
2. Check `<title>` contains the product name
3. Verify the login form renders (email + password inputs visible)

---

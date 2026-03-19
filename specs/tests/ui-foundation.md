# UI Foundation — Playwright Test Spec

**Sprint:** 15  
**Depends on:** Vite dev server running on `http://localhost:5173`

## Test Steps

### 1. Root redirect to login

1. Open `http://localhost:5173`
2. Expect redirect to `http://localhost:5173/login`
3. Verify URL ends with `/login`

### 2. Page title

1. Navigate to `http://localhost:5173/login`
2. Check `document.title` contains "HoriFlow"

### 3. Login page renders

1. Navigate to `http://localhost:5173/login`
2. Verify `<h1>` with text "Log in" is visible
3. _(Full form tested in Sprint 16)_

### 4. Unknown route shows 404

1. Navigate to `http://localhost:5173/does-not-exist`
2. Verify "404" text is present on the page

### 5. Authenticated user at /login redirects to /workspaces

1. Inject Redux store state with `status: 'authenticated'` and a dummy token
2. Navigate to `/login`
3. Expect redirect to `/workspaces`

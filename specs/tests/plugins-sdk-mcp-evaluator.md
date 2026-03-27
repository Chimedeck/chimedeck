> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Playwright MCP Evaluator Test Plan — Iteration 6 (2026-03-05)

## Context
- No Playwright or MCP evaluator tests currently exist for the plugin SDK flows (jhInstance, FrameContext, PLUGIN_READY, TrelloPowerUp).
- No test files or specs reference these flows.
- The SDK was added and built, but no automated browser tests exist to verify its integration.

## Manual Test Plan

### 1. Load plugin iframe and verify jhInstance initializes
- [ ] Open a page that loads a plugin iframe.
- [ ] Confirm `jhInstance` initializes and posts `PLUGIN_READY` to the host (check console or network).

### 2. Use SDK in modal/section page and test FrameContext
- [ ] Open a modal or section page using the SDK.
- [ ] Call `t.get`, `t.set` and verify correct behavior (e.g., state is set and retrieved).

### 3. Interact with host via capability handlers
- [ ] Trigger a capability handler from the plugin (e.g., request data from host).
- [ ] Confirm correct message passing and response.

### 4. Access SDK via /sdk/jh-instance.js in browser
- [ ] Visit `/sdk/jh-instance.js` in browser.
- [ ] Confirm it loads with `Content-Type: application/javascript` and is not empty.

### 5. Trello Power-Up compatibility
- [ ] Open a plugin page and check `window.TrelloPowerUp` is set.
- [ ] Call a basic Power-Up method and verify it works.

## Edge/Error Scenarios
- [ ] Try initializing SDK with missing/invalid config and confirm error handling.
- [ ] Attempt to use FrameContext methods before initialization and check for safe errors.

## Next Steps
- Implement Playwright MCP evaluator tests for these flows in the next iteration.
- Add at least one test per flow above, using Playwright's browser automation.
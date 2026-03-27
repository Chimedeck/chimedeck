> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 92 — Iteration 2: Plugins — Edit modal, Board panel, Domain allowlist

Purpose
- Verify Plugins edit modal, board plugins panel, and domain allowlist copy are
  sourced from `src/extensions/Plugins/translations/en.json`.

Preconditions
- Dev server (MCP) is running and Plugins feature enabled.

Steps
1. Open Edit Plugin modal: assert `Edit Plugin` title, `Save Changes`, `Cancel`, and `Delete Plugin` labels and the delete confirmation copy.
2. Open BoardPluginsPanel: assert `Enable` / `Disable` / `Configure` buttons and `No plugins available for this board` empty copy.
3. Open PluginDomainAllowlist: assert `Allowed Domains` title, add placeholder `Add domain…`, `Add` button and remove aria label `Remove domain`.

Expected
- All plugin UI strings above come from the translations JSON; no hard-coded strings remain.
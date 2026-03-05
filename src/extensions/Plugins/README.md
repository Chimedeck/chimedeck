# Plugins Extension

Client-side plugin management for board admins.

## Route

`/boards/:boardId/settings/plugins` — board admin only.

## Structure

```
Plugins/
├── config/pluginsConfig.ts          ← API paths config
├── api.ts                           ← API wrappers (fetchBoardPlugins, enablePlugin, etc.)
├── reducers.ts                      ← re-exports pluginDashboardReducer
├── routes.ts                        ← registers /boards/:boardId/settings/plugins
├── components/
│   ├── PluginCard.tsx               ← single plugin row with enable/disable button
│   ├── PluginList.tsx               ← active + available sections
│   └── PluginCapabilityChips.tsx    ← compact capability chip list
├── containers/PluginDashboardPage/
│   ├── PluginDashboardPage.tsx      ← page shell, admin gate via API 403
│   └── PluginDashboardPage.duck.ts  ← Redux: fetch, enable, disable with optimistic updates
└── hooks/useBoardPlugins.ts         ← thin hook wrapping duck selectors + dispatchers
```

## Redux State

```ts
{
  boardPlugins: BoardPlugin[];    // active on this board
  availablePlugins: Plugin[];     // in registry, not yet enabled
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}
```

## Access Control

Server enforces board admin access via `boardAdminGuard` middleware. Client redirects to board on 403.

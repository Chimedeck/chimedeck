// Feature config for the Plugins extension.
// All environment-specific values and API paths are centralised here.
export const pluginsConfig = {
  /** Base path for board-plugin API calls */
  boardPluginsPath: (boardId: string) => `/api/v1/boards/${boardId}/plugins`,
  /** Base path for the plugin registry (available plugins) */
  registryPath: '/api/v1/plugins',
};

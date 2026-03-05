// Feature config for the Plugins extension.
// All environment-specific values and API paths are centralised here.
// NOTE: apiClient already has baseURL '/api/v1', so paths here are relative to that.
export const pluginsConfig = {
  /** Base path for board-plugin API calls */
  boardPluginsPath: (boardId: string) => `/boards/${boardId}/plugins`,
  /** Base path for the plugin registry (available plugins) */
  registryPath: '/plugins',
};

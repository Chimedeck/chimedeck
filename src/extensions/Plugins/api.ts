// Fetch wrappers for board-plugins + plugin registry endpoints.
import { apiClient } from '~/common/api/client';
import { pluginsConfig } from './config/pluginsConfig';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  connectorUrl: string;
  authorName?: string;
  capabilities: string[];
  categories: string[];
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
}

export interface BoardPlugin {
  id: string;
  boardId: string;
  plugin: Plugin;
  enabledAt: string;
  disabledAt: string | null;
}

/** GET /api/v1/boards/:boardId/plugins — active plugins for the board */
export async function fetchBoardPlugins({ boardId }: { boardId: string }): Promise<{ data: BoardPlugin[] }> {
  return apiClient.get(pluginsConfig.boardPluginsPath(boardId));
}

/** GET /api/v1/plugins — public+active plugin registry */
export async function fetchAvailablePlugins(): Promise<{ data: Plugin[] }> {
  return apiClient.get(pluginsConfig.registryPath);
}

/** POST /api/v1/boards/:boardId/plugins — enable a plugin on a board */
export async function enablePlugin({
  boardId,
  pluginId,
}: {
  boardId: string;
  pluginId: string;
}): Promise<{ data: BoardPlugin }> {
  return apiClient.post(pluginsConfig.boardPluginsPath(boardId), { pluginId });
}

/** DELETE /api/v1/boards/:boardId/plugins/:pluginId — disable a plugin on a board */
export async function disablePlugin({
  boardId,
  pluginId,
}: {
  boardId: string;
  pluginId: string;
}): Promise<{ data: BoardPlugin }> {
  return apiClient.delete(`${pluginsConfig.boardPluginsPath(boardId)}/${pluginId}`);
}

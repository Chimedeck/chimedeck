// Fetch wrappers for board-plugins + plugin registry endpoints.
import { apiClient } from '~/common/api/client';
import { pluginsConfig } from './config/pluginsConfig';
import type { BoardPluginConfig } from './types';

export type { BoardPluginConfig };

export interface Plugin {
  id: string;
  apiKey?: string;
  name: string;
  slug?: string;
  description: string;
  iconUrl?: string;
  connectorUrl: string;
  manifestUrl?: string;
  author?: string;
  authorEmail?: string;
  supportEmail?: string;
  capabilities: string[];
  categories: string[];
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt?: string;
  whitelistedDomains?: string[];
}

export interface BoardPlugin {
  id: string;
  boardId: string;
  plugin: Plugin;
  enabledAt: string;
  disabledAt: string | null;
  config?: BoardPluginConfig;
}

/** GET /api/v1/boards/:boardId/plugins — active plugins for the board */
export async function fetchBoardPlugins({ boardId }: { boardId: string }): Promise<{ data: BoardPlugin[] }> {
  return apiClient.get(pluginsConfig.boardPluginsPath(boardId));
}

export interface FetchAvailablePluginsParams {
  q?: string;
  category?: string | null;
  page?: number;
  perPage?: number;
  /** Filter by active state — undefined means no filter (returns all) */
  isActive?: boolean;
}

/** GET /api/v1/boards/:boardId/plugins/available — active plugins NOT yet enabled on this board */
export async function fetchBoardAvailablePlugins({
  boardId,
  q,
  category,
}: {
  boardId: string;
  q?: string;
  category?: string | null;
}): Promise<{ data: Plugin[]; metadata: { total: number } }> {
  const searchParams = new URLSearchParams();
  if (q) searchParams.set('q', q);
  if (category) searchParams.set('category', category);
  const qs = searchParams.toString();
  return apiClient.get(
    qs
      ? `${pluginsConfig.boardPluginsPath(boardId)}/available?${qs}`
      : `${pluginsConfig.boardPluginsPath(boardId)}/available`,
  );
}

/** GET /api/v1/plugins — public+active plugin registry, with optional search/filter/pagination */
export async function fetchAvailablePlugins(
  params?: FetchAvailablePluginsParams,
): Promise<{ data: Plugin[] }> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set('q', params.q);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.perPage != null) searchParams.set('perPage', String(params.perPage));
  if (params?.isActive != null) searchParams.set('isActive', String(params.isActive));
  const qs = searchParams.toString();
  return apiClient.get(qs ? `${pluginsConfig.registryPath}?${qs}` : pluginsConfig.registryPath);
}

/** GET /api/v1/plugins/categories — deduplicated list of category strings */
export async function fetchCategories(): Promise<{ data: string[] }> {
  return apiClient.get(`${pluginsConfig.registryPath}/categories`);
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

export interface RegisterPluginBody {
  name: string;
  slug: string;
  description: string;
  connectorUrl: string;
  manifestUrl?: string;
  iconUrl?: string;
  author: string;
  authorEmail?: string;
  supportEmail?: string;
  categories?: string[];
  isPublic?: boolean;
  whitelistedDomains?: string[];
}

/** POST /api/v1/plugins — register a new plugin (platform admin only). Returns api_key once. */
export async function registerPlugin(body: RegisterPluginBody): Promise<{ data: Plugin & { apiKey: string } }> {
  return apiClient.post(pluginsConfig.registryPath, body);
}

export interface UpdatePluginBody {
  name?: string;
  description?: string;
  connectorUrl?: string;
  manifestUrl?: string;
  iconUrl?: string;
  author?: string;
  authorEmail?: string;
  supportEmail?: string;
  categories?: string[];
  isPublic?: boolean;
  whitelistedDomains?: string[];
}

/** PATCH /api/v1/plugins/:pluginId — update plugin fields (platform admin only). */
export async function updatePlugin({
  pluginId,
  body,
}: {
  pluginId: string;
  body: UpdatePluginBody;
}): Promise<{ data: Plugin }> {
  return apiClient.patch(`${pluginsConfig.registryPath}/${pluginId}`, body);
}

/** DELETE /api/v1/plugins/:pluginId — soft-deactivate a plugin (platform admin only). */
export async function deletePlugin({
  pluginId,
}: {
  pluginId: string;
}): Promise<{ data: Plugin }> {
  return apiClient.delete(`${pluginsConfig.registryPath}/${pluginId}`);
}

/** PATCH /api/v1/plugins/:pluginId — reactivate a deactivated plugin (platform admin only). */
export async function reactivatePlugin({
  pluginId,
}: {
  pluginId: string;
}): Promise<{ data: Plugin }> {
  return apiClient.patch(`${pluginsConfig.registryPath}/${pluginId}`, { isActive: true });
}

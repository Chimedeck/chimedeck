// Plugin API router — mounts all plugin-related routes under /api/v1.
import { handleListBoardPlugins } from './board-plugins/list';
import { handleEnableBoardPlugin } from './board-plugins/enable';
import { handleDisableBoardPlugin } from './board-plugins/disable';
import { handleSetBoardPluginAllowedDomains } from './board-plugins/allowed-domains';
import { handleGetPluginToken } from './board-plugins/token';
import { handleListAvailableBoardPlugins } from './board-plugins/available';
import { handleGetPluginData } from './plugin-data/get';
import { handleSetPluginData } from './plugin-data/set';
import { handleListPlugins } from './registry/list';
import { handleListCategories } from './registry/categories';
import { handleGetPlugin } from './registry/get';
import { handleCreatePlugin } from './registry/create';
import { handleUpdatePlugin } from './registry/update';
import { handleDeletePlugin } from './registry/delete';
import { resolveBoardId } from '../../../common/ids/resolveEntityId';

// Returns a Response if the path matches a plugin route, otherwise null.
export async function pluginsRouter(req: Request, pathname: string): Promise<Response | null> {
  // Board plugin routes: /api/v1/boards/:boardId/plugins[/:pluginId[/allowed-domains|/token]]
  const boardPluginsMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/plugins(\/[^/]+)?(\/allowed-domains|\/token)?$/);
  if (boardPluginsMatch) {
    const boardIdentifier = boardPluginsMatch[1] as string;
    const boardId = await resolveBoardId(boardIdentifier);
    if (!boardId) {
      return Response.json(
        { error: { code: 'board-not-found', message: 'Board not found' } },
        { status: 404 },
      );
    }
    const pluginSegment = boardPluginsMatch[2] ?? '';
    const subResource = boardPluginsMatch[3] ?? '';

    // GET /api/v1/boards/:boardId/plugins/available — list plugins not yet enabled on this board
    if (pluginSegment === '/available' && subResource === '' && req.method === 'GET') {
      return handleListAvailableBoardPlugins(req, boardId);
    }

    // PATCH /api/v1/boards/:boardId/plugins/:pluginId/allowed-domains
    if (pluginSegment !== '' && subResource === '/allowed-domains' && req.method === 'PATCH') {
      const pluginId = pluginSegment.slice(1);
      return handleSetBoardPluginAllowedDomains(req, boardId, pluginId);
    }

    // GET /api/v1/boards/:boardId/plugins/:pluginId/token — issue short-lived plugin JWT
    if (pluginSegment !== '' && subResource === '/token' && req.method === 'GET') {
      const pluginId = pluginSegment.slice(1);
      return handleGetPluginToken(req, boardId, pluginId);
    }

    // GET /api/v1/boards/:boardId/plugins — list active plugins
    if (pluginSegment === '' && req.method === 'GET') return handleListBoardPlugins(req, boardId);

    // POST /api/v1/boards/:boardId/plugins — enable a plugin
    if (pluginSegment === '' && req.method === 'POST') return handleEnableBoardPlugin(req, boardId);

    // DELETE /api/v1/boards/:boardId/plugins/:pluginId — soft-disable a plugin
    if (pluginSegment !== '' && subResource === '' && req.method === 'DELETE') {
      const pluginId = pluginSegment.slice(1); // strip leading "/"
      return handleDisableBoardPlugin(req, boardId, pluginId);
    }
  }

  // Plugin data routes: /api/v1/plugins/data
  if (pathname === '/api/v1/plugins/data') {
    if (req.method === 'GET') return handleGetPluginData(req);
    if (req.method === 'PUT') return handleSetPluginData(req);
  }

  // Plugin registry routes: /api/v1/plugins[/:pluginId]
  const registryMatch = pathname.match(/^\/api\/v1\/plugins(\/[^/]+)?$/);
  if (registryMatch) {
    const pluginSegment = registryMatch[1] ?? '';

    // GET /api/v1/plugins — list plugins
    if (pluginSegment === '' && req.method === 'GET') return handleListPlugins(req);

    // POST /api/v1/plugins — register a new plugin
    if (pluginSegment === '' && req.method === 'POST') return handleCreatePlugin(req);

    // GET /api/v1/plugins/categories — must be matched before /:pluginId
    if (pluginSegment === '/categories' && req.method === 'GET') return handleListCategories(req);

    if (pluginSegment !== '') {
      const pluginId = pluginSegment.slice(1);

      // GET /api/v1/plugins/:pluginId — get plugin detail
      if (req.method === 'GET') return handleGetPlugin(req, pluginId);

      // PATCH /api/v1/plugins/:pluginId — update plugin
      if (req.method === 'PATCH') return handleUpdatePlugin(req, pluginId);

      // DELETE /api/v1/plugins/:pluginId — soft-delete plugin
      if (req.method === 'DELETE') return handleDeletePlugin(req, pluginId);
    }
  }

  return null;
}

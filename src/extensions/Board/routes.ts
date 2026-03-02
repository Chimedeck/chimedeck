// Route configuration for the Board extension.
import type { RouteConfig } from '~/config/routeTypes';

export const routes: RouteConfig[] = [
  {
    path: '/workspace/:workspaceId/boards',
    component: () =>
      import('./containers/BoardListPage/BoardListPage').then((m) => m.default),
    name: 'BoardListPage',
    auth: true,
  },
  {
    path: '/boards/:boardId',
    component: () =>
      import('./containers/BoardPage/BoardPage').then((m) => m.default),
    name: 'BoardPage',
    auth: true,
  },
];

export default routes;

// Route configuration for the Plugins extension.
import type { RouteConfig } from '~/config/routeTypes';

export const routes: RouteConfig[] = [
  {
    path: '/boards/:boardId/settings/plugins',
    component: () =>
      import('./containers/PluginDashboardPage/PluginDashboardPage').then((m) => m.default),
    name: 'PluginDashboardPage',
    auth: true,
  },
];

export default routes;

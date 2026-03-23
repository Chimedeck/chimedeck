// Route configuration for the ApiToken extension.
import type { RouteConfig } from '~/config/routeTypes';

export const routes: RouteConfig[] = [
  {
    path: '/settings/api-tokens',
    component: () =>
      import('./containers/ApiTokenPage/ApiTokenPage').then((m) => m.default),
    name: 'ApiTokenPage',
    auth: true,
  },
];

export default routes;

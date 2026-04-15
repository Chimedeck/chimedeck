// Route configuration for the Webhooks extension.
import type { RouteConfig } from '~/config/routeTypes';

export const routes: RouteConfig[] = [
  {
    path: '/settings/webhooks',
    component: () =>
      import('./containers/WebhooksRegisterPage/WebhooksRegisterPage').then(
        (m) => m.default,
      ),
    name: 'WebhooksRegisterPage',
    auth: true,
  },
];

export default routes;

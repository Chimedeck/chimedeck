// Route configuration for the Auth extension.
import type { RouteConfig } from '~/config/routeTypes';

export const routes: RouteConfig[] = [
  {
    path: '/login',
    component: () =>
      import('./containers/LoginPage/LoginPage').then((m) => m.default),
    name: 'LoginPage',
    auth: false,
  },
  {
    path: '/signup',
    component: () =>
      import('./containers/SignupPage/SignupPage').then((m) => m.default),
    name: 'SignupPage',
    auth: false,
  },
];

export default routes;

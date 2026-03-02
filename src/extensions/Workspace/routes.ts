// Route configuration for the Workspace extension.
// Integrate these routes into the root router of the application.

import type { RouteConfig } from '~/config/routeTypes';

export const routes: RouteConfig[] = [
  {
    path: '/workspaces',
    component: () =>
      import('./containers/WorkspaceListPage/WorkspaceListPage').then(
        (m) => m.default
      ),
    name: 'WorkspaceListPage',
    auth: true,
  },
  {
    path: '/workspace',
    component: () =>
      import('./containers/WorkspacePage/WorkspacePage').then(
        (m) => m.default
      ),
    name: 'WorkspacePage',
    auth: true,
  },
  {
    path: '/workspace/:workspaceId',
    component: () =>
      import('./containers/WorkspacePage/WorkspacePage').then(
        (m) => m.default
      ),
    name: 'WorkspaceDetailPage',
    auth: true,
  },
  {
    path: '/invites/:token/accept',
    component: () =>
      import('./containers/AcceptInvitePage/AcceptInvitePage').then(
        (m) => m.default
      ),
    name: 'AcceptInvitePage',
    // Accept-invite route is accessible without auth so the user can see
    // invite details before being prompted to log in.
    auth: false,
  },
];

export default routes;

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
  // [why] /workspaces/:workspaceId/boards uses WorkspaceDashboard (Workspace extension)
  // rather than the Board extension's BoardListPage so that guest-role gating
  // (hiding Create Board, showing guest badges) lives alongside other workspace UI.
  {
    path: '/workspaces/:workspaceId/boards',
    component: () =>
      import('./containers/WorkspaceDashboard').then(
        (m) => m.default
      ),
    name: 'WorkspaceDashboard',
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

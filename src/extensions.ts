// Global extension registry — import all extension routes here.
// The router in src/routing/index.tsx handles route rendering directly via
// lazy imports; this file exists as a manifest of registered extensions.
import authRoutes from './extensions/Auth/routes';
import boardRoutes from './extensions/Board/routes';
import workspaceRoutes from './extensions/Workspace/routes';

export const allExtensionRoutes = [
  ...authRoutes,
  ...workspaceRoutes,
  ...boardRoutes,
];

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import Spinner from '~/common/components/Spinner';
import AppShell from '~/layout/AppShell';

// All pages are lazy-loaded — the router shell renders immediately while page chunks load
const LoginPage = lazy(() =>
  import('~/extensions/Auth/containers/LoginPage/LoginPage').then((m) => ({
    default: m.default,
  }))
);
const SignupPage = lazy(() =>
  import('~/extensions/Auth/containers/SignupPage/SignupPage').then((m) => ({
    default: m.default,
  }))
);
const WorkspacesPage = lazy(() =>
  import(
    '~/extensions/Workspace/containers/WorkspaceListPage/WorkspaceListPage'
  ).then((m) => ({ default: m.default }))
);
const BoardsPage = lazy(() =>
  import(
    '~/extensions/Board/containers/BoardListPage/BoardListPage'
  ).then((m) => ({ default: m.default }))
);
const BoardPage = lazy(() =>
  import('~/extensions/Board/containers/BoardPage/BoardPage').then((m) => ({
    default: m.default,
  }))
);
const NotFoundPage = lazy(() =>
  import('~/pages/NotFoundPage').then((m) => ({ default: m.default }))
);

const LoadingFallback = () => (
  <div className="flex h-screen items-center justify-center bg-gray-900">
    <Spinner size="lg" className="text-blue-500" />
  </div>
);

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public-only routes — redirect if already logged in */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          {/* Private routes wrapped in AppShell (sidebar + content) */}
          <Route element={<PrivateRoute />}>
            <Route element={<AppShell />}>
              <Route path="/workspaces" element={<WorkspacesPage />} />
              <Route
                path="/workspaces/:workspaceId/boards"
                element={<BoardsPage />}
              />
              <Route path="/boards/:boardId" element={<BoardPage />} />
            </Route>
          </Route>

          {/* Redirect root to /workspaces (PrivateRoute handles auth check) */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Navigate to="/workspaces" replace />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

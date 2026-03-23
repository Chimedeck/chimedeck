import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import GuestBlockedRoute from './GuestBlockedRoute';
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
const WorkspacePage = lazy(() =>
  import(
    '~/extensions/Workspace/containers/WorkspacePage/WorkspacePage'
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
const PluginDocsPage = lazy(() =>
  import('~/extensions/DeveloperDocs/containers/PluginDocsPage/PluginDocsPage').then((m) => ({
    default: m.default,
  }))
);
const VerifyEmailPage = lazy(() =>
  import('~/extensions/Auth/containers/VerifyEmailPage/VerifyEmailPage').then((m) => ({
    default: m.default,
  }))
);
const ConfirmEmailChangePage = lazy(() =>
  import('~/extensions/Auth/containers/ConfirmEmailChangePage/ConfirmEmailChangePage').then((m) => ({
    default: m.default,
  }))
);
const ForgotPasswordPage = lazy(() =>
  import('~/extensions/Auth/containers/ForgotPasswordPage/ForgotPasswordPage').then((m) => ({
    default: m.default,
  }))
);
const ResetPasswordPage = lazy(() =>
  import('~/extensions/Auth/containers/ResetPasswordPage/ResetPasswordPage').then((m) => ({
    default: m.default,
  }))
);
const ProfilePage = lazy(() =>
  import('~/extensions/User/containers/ProfilePage/ProfilePage').then((m) => ({
    default: m.default,
  }))
);
const EditProfilePage = lazy(() =>
  import('~/extensions/UserProfile/containers/EditProfilePage/EditProfilePage').then((m) => ({
    default: m.default,
  }))
);
const PluginDashboardPage = lazy(() =>
  import('~/extensions/Plugins/containers/PluginDashboardPage/PluginDashboardPage').then((m) => ({
    default: m.default,
  }))
);
const ApiTokenPage = lazy(() =>
  import('~/extensions/ApiToken/containers/ApiTokenPage/ApiTokenPage').then((m) => ({
    default: m.default,
  }))
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

          {/* Public route for email verification — accessible without auth */}
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Public route for email change confirmation — accessible without auth */}
          <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />

          {/* Public routes for password reset — accessible without auth */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Private routes wrapped in AppShell (sidebar + content) */}
          <Route element={<PrivateRoute />}>
            <Route element={<AppShell />}>
              <Route path="/workspaces" element={<WorkspacesPage />} />
              <Route
                path="/workspaces/:workspaceId/boards"
                element={<BoardsPage />}
              />
              {/* Workspace members/settings page — redirect GUEST users to their boards */}
              <Route element={<GuestBlockedRoute />}>
                <Route
                  path="/workspace/:workspaceId"
                  element={<WorkspacePage />}
                />
              </Route>
              <Route path="/boards/:boardId" element={<BoardPage />} />
              <Route path="/boards/:boardId/settings/plugins" element={<PluginDashboardPage />} />
              <Route path="/settings/profile" element={<ProfilePage />} />
              <Route path="/settings/api-tokens" element={<ApiTokenPage />} />
              <Route path="/profile/edit" element={<EditProfilePage />} />
              <Route path="/developer/plugins" element={<PluginDocsPage />} />
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

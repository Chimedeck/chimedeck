import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectIsAuthenticated, selectAuthStatus } from '~/extensions/Auth/duck/authDuck';

// Guards public-only routes (login, signup) — redirects authenticated users to /workspaces.
// During loading/idle (refresh in-flight on boot) we render the public page as-is;
// if the refresh succeeds the user will be redirected once status resolves.
export default function PublicRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const status = useAppSelector(selectAuthStatus);

  if (status === 'idle' || status === 'loading') return <Outlet />;
  return isAuthenticated ? <Navigate to="/workspaces" replace /> : <Outlet />;
}

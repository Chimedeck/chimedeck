import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectIsAuthenticated, selectAuthStatus } from '~/extensions/Auth/duck/authDuck';

// Guards private routes — redirects to /login when no token is in the store.
// Deny-first: unauthenticated is the default state until proven otherwise.
// During loading/idle (refresh in-flight on boot) we render nothing to avoid
// a premature redirect that would send authenticated users to /login.
export default function PrivateRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const status = useAppSelector(selectAuthStatus);

  if (status === 'idle' || status === 'loading') return null;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

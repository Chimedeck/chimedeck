import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectIsAuthenticated } from '~/extensions/Auth/duck/authDuck';

// Guards public-only routes (login, signup) — redirects authenticated users to /workspaces
export default function PublicRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return isAuthenticated ? <Navigate to="/workspaces" replace /> : <Outlet />;
}

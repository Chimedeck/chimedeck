import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectIsAuthenticated } from '~/extensions/Auth/duck/authDuck';

// Guards private routes — redirects to /login when no token is in the store.
// Deny-first: unauthenticated is the default state until proven otherwise.
export default function PrivateRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

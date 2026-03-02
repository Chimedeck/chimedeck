import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectIsAuthenticated } from './duck/authDuck';

// Auth-extension-scoped PrivateRoute — mirrors src/routing/PrivateRoute.tsx
// but uses Auth extension selectors directly for tight cohesion.
export default function PrivateRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

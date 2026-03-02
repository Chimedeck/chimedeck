import { useEffect } from 'react';
import AppRouter from './routing';
import { useAppDispatch } from './hooks/useAppDispatch';
import { refreshTokenThunk } from './extensions/Auth/duck/authDuck';

// App wraps the router only — Provider is in main.tsx so tests can supply their own store
export default function App() {
  const dispatch = useAppDispatch();

  // Attempt token refresh on boot so authenticated users stay logged in after a page reload.
  // On failure, authDuck sets status to 'unauthenticated' — PrivateRoute handles the redirect.
  useEffect(() => {
    dispatch(refreshTokenThunk());
  }, [dispatch]);

  return <AppRouter />;
}

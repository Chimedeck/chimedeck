import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import { setTokenGetter } from './common/api/client';
import { setClearAuthCallback } from './common/api/interceptors';
import { clearAuth } from './extensions/Auth/duck/authDuck';
import { socket } from './extensions/Realtime/client/socket';
import App from './App';
import './index.css';

// Apply saved theme before React renders to prevent flash of wrong theme.
// Default to dark when no preference is stored.
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark');
} else {
  document.documentElement.classList.add('dark');
}

// Wire up the API client with store access — done here to avoid circular deps
// between the client and the store modules
setTokenGetter(
  () => (store.getState() as { auth: { accessToken: string | null } }).auth.accessToken
);
setClearAuthCallback(() => store.dispatch(clearAuth()));

// WS close code 4001 = server revoked this session.
// Clear Redux auth state and redirect to login so the user is informed.
socket.setForcedLogoutCallback(() => {
  store.dispatch(clearAuth());
  window.location.href = '/login?reason=session_expired';
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

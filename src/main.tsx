import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import { setTokenGetter } from './common/api/client';
import { setClearAuthCallback } from './common/api/interceptors';
import { clearAuth } from './extensions/Auth/duck/authDuck';
import { socket } from './extensions/Realtime/client/socket';
import { initSentry } from './common/monitoring/sentryClient';
import { ErrorBoundary } from './common/monitoring/ErrorBoundary';
import App from './App';
import './index.css';

// Initialise Sentry before any React rendering so all bootstrap errors are captured.
// No-op when VITE_SENTRY_CLIENT_ENABLED is false or DSN is missing.
initSentry();

// Apply saved theme before React renders to prevent flash of wrong theme.
// Default to dark when no preference is stored.
const savedTheme = localStorage.getItem('theme');
const html = document.documentElement;
html.classList.remove('dark', 'elegant', 'elegant-dark', 'theme-paper', 'theme-nordic', 'theme-archive', 'theme-macintosh', 'theme-obsidian', 'theme-next', 'theme-bauhaus', 'theme-moss', 'theme-vapor', 'theme-cyberpunk', 'theme-the-seven', 'theme-hc-light', 'theme-hc-dark');
if (savedTheme === 'dark') {
  html.classList.add('dark');
} else if (savedTheme === 'elegant') {
  html.classList.add('elegant');
} else if (savedTheme === 'elegant-dark') {
  html.classList.add('dark', 'elegant-dark');
} else if (savedTheme === 'paper') {
  html.classList.add('theme-paper');
} else if (savedTheme === 'nordic') {
  html.classList.add('dark', 'theme-nordic');
} else if (savedTheme === 'archive') {
  html.classList.add('theme-archive');
} else if (savedTheme === 'macintosh') {
  html.classList.add('theme-macintosh');
} else if (savedTheme === 'obsidian') {
  html.classList.add('dark', 'theme-obsidian');
} else if (savedTheme === 'next') {
  html.classList.add('theme-next');
} else if (savedTheme === 'bauhaus') {
  html.classList.add('theme-bauhaus');
} else if (savedTheme === 'moss') {
  html.classList.add('theme-moss');
} else if (savedTheme === 'vapor') {
  html.classList.add('dark', 'theme-vapor');
} else if (savedTheme === 'cyberpunk') {
  html.classList.add('dark', 'theme-cyberpunk');
} else if (savedTheme === 'the-seven') {
  html.classList.add('dark', 'theme-the-seven');
} else if (savedTheme === 'hc-light') {
  html.classList.add('theme-hc-light');
} else if (savedTheme === 'hc-dark') {
  html.classList.add('dark', 'theme-hc-dark');
} else if (savedTheme !== 'light') {
  // Default: dark
  html.classList.add('dark');
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
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

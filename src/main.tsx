import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import { setTokenGetter } from './common/api/client';
import { setClearAuthCallback } from './common/api/interceptors';
import { clearAuth } from './extensions/Auth/duck/authDuck';
import App from './App';
import './index.css';

// Wire up the API client with store access — done here to avoid circular deps
// between the client and the store modules
setTokenGetter(
  () => (store.getState() as { auth: { accessToken: string | null } }).auth.accessToken
);
setClearAuthCallback(() => store.dispatch(clearAuth()));

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

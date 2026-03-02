import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../common/api/client';
import { authReducer, workspaceShellReducer } from '../reducers';
import { uiReducer } from '../slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    workspaceShell: workspaceShellReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Inject the API client so async thunks can use `extra.api` without
      // importing the client directly (avoids circular dep at module level)
      thunk: { extraArgument: { api: apiClient } },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

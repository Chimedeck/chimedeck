import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../common/api/client';
import { authReducer, workspaceShellReducer, boardReducer, boardListPageReducer, boardPageReducer, workspacePageReducer, cardDetailReducer, listReducer, cardsReducer, profileDuckReducer, notificationReducer } from '../reducers';
import { uiReducer } from '../slices/uiSlice';
import { wsMiddleware } from '../extensions/Realtime/middleware/wsMiddleware';
import { verifyEmailDuckReducer } from '../extensions/Auth/containers/VerifyEmailPage/VerifyEmailPage.duck';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    workspaceShell: workspaceShellReducer,
    boardListPage: boardListPageReducer,
    boardPage: boardPageReducer,
    WorkspacePage: workspacePageReducer,
    board: boardReducer,
    cardDetail: cardDetailReducer,
    lists: listReducer,
    cards: cardsReducer,
    verifyEmail: verifyEmailDuckReducer,
    profile: profileDuckReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Inject the API client so async thunks can use `extra.api` without
      // importing the client directly (avoids circular dep at module level)
      thunk: { extraArgument: { api: apiClient } },
    }).concat(wsMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

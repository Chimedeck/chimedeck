import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../common/api/client';
import { authReducer, workspaceShellReducer, boardReducer, boardListPageReducer, boardPageReducer, workspacePageReducer, cardDetailReducer, listReducer, cardsReducer, profileDuckReducer, notificationReducer, pluginDashboardReducer, adminInviteReducer, viewPreferenceReducer, notificationPreferencesApi } from '../reducers';
import { uiReducer } from '../slices/uiSlice';
import { featureFlagsReducer } from '../slices/featureFlagsSlice';
import { wsMiddleware } from '../extensions/Realtime/middleware/wsMiddleware';
import { verifyEmailDuckReducer } from '../extensions/Auth/containers/VerifyEmailPage/VerifyEmailPage.duck';
import { confirmEmailChangeDuckReducer } from '../extensions/Auth/containers/ConfirmEmailChangePage/ConfirmEmailChangePage.duck';
import { forgotPasswordDuckReducer } from '../extensions/Auth/containers/ForgotPasswordPage/ForgotPasswordPage.duck';
import { resetPasswordDuckReducer } from '../extensions/Auth/containers/ResetPasswordPage/ResetPasswordPage.duck';

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
    confirmEmailChange: confirmEmailChangeDuckReducer,
    forgotPassword: forgotPasswordDuckReducer,
    resetPassword: resetPasswordDuckReducer,
    profile: profileDuckReducer,
    notifications: notificationReducer,
    pluginDashboard: pluginDashboardReducer,
    adminInvite: adminInviteReducer,
    viewPreference: viewPreferenceReducer,
    featureFlags: featureFlagsReducer,
    [notificationPreferencesApi.reducerPath]: notificationPreferencesApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Inject the API client so async thunks can use `extra.api` without
      // importing the client directly (avoids circular dep at module level)
      thunk: { extraArgument: { api: apiClient } },
    }).concat(wsMiddleware, notificationPreferencesApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

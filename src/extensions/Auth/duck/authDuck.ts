import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { authApi } from '../api/auth';

// ---------- Types ----------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface AuthDuckState {
  user: AuthUser | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
}

// ---------- Initial state ----------

const initialState: AuthDuckState = {
  user: null,
  accessToken: null,
  // Start as 'idle' so route guards can distinguish "not yet checked" from
  // "checked and found unauthenticated", preventing premature redirects on boot.
  status: 'idle',
  error: null,
};

// ---------- Thunks ----------

export const loginThunk = createAppAsyncThunk(
  'auth/login',
  async (
    { email, password }: { email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await authApi.login({ email, password });
      return response.data;
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.response.data.name : 'login-failed';
      return rejectWithValue(msg);
    }
  }
);

export const signupThunk = createAppAsyncThunk(
  'auth/signup',
  async (
    { name, email, password }: { name: string; email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await authApi.signup({ name, email, password });
      return response.data;
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.response.data.name : 'signup-failed';
      return rejectWithValue(msg);
    }
  }
);

export const refreshTokenThunk = createAppAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.refreshToken();
      return response.data;
    } catch {
      // Failure is expected when not authenticated — PrivateRoute handles redirect
      return rejectWithValue('unauthenticated');
    }
  }
);

export const logoutThunk = createAppAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
    } catch (err: unknown) {
      // Best-effort logout — clear local state regardless
      if (isApiError(err) && err.response.status !== 401) {
        return rejectWithValue('logout-failed');
      }
    }
  }
);

// ---------- Slice ----------

const authDuck = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: AuthUser; accessToken: string }>
    ) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
      state.error = null;
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = action.payload as string;
      })
      .addCase(signupThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signupThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(signupThunk.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = action.payload as string;
      })
      .addCase(refreshTokenThunk.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        state.status = 'unauthenticated';
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'unauthenticated';
        state.error = null;
      });
  },
});

export const { setCredentials, clearAuth } = authDuck.actions;
export const authDuckReducer = authDuck.reducer;

// ---------- Selectors ----------

export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectAuthToken = (state: RootState) => state.auth.accessToken;
export const selectIsAuthenticated = (state: RootState) =>
  state.auth.status === 'authenticated';
export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectAuthError = (state: RootState) => state.auth.error;

// ---------- Helpers ----------

function isApiError(
  err: unknown
): err is { response: { status: number; data: { name: string } } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>)['response'] === 'object'
  );
}

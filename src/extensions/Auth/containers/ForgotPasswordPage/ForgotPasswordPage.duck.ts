import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { authApi } from '../../api/auth';

// ---------- Types ----------

interface ForgotPasswordState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ---------- Initial state ----------

const initialState: ForgotPasswordState = {
  status: 'idle',
  error: null,
};

// ---------- Thunks ----------

export const forgotPasswordThunk = createAppAsyncThunk(
  'forgotPassword/send',
  async ({ email }: { email: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.forgotPassword({ email });
      return (response as unknown as { data: { sent: boolean } }).data;
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.response.data.name : 'forgot-password-failed';
      return rejectWithValue(msg);
    }
  }
);

// ---------- Slice ----------

const forgotPasswordDuck = createSlice({
  name: 'forgotPassword',
  initialState,
  reducers: {
    resetForgotPassword: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(forgotPasswordThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(forgotPasswordThunk.fulfilled, (state) => {
        state.status = 'success';
      })
      .addCase(forgotPasswordThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload as string;
      });
  },
});

export const { resetForgotPassword } = forgotPasswordDuck.actions;
export const forgotPasswordDuckReducer = forgotPasswordDuck.reducer;

// ---------- Selectors ----------

export const selectForgotPasswordStatus = (state: RootState) => state.forgotPassword.status;
export const selectForgotPasswordError = (state: RootState) => state.forgotPassword.error;

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

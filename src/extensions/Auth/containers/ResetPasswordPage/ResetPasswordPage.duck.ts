import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { authApi } from '../../api/auth';

// ---------- Types ----------

interface ResetPasswordState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ---------- Initial state ----------

const initialState: ResetPasswordState = {
  status: 'idle',
  error: null,
};

// ---------- Thunks ----------

export const resetPasswordThunk = createAppAsyncThunk(
  'resetPassword/reset',
  async ({ token, password }: { token: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.resetPassword({ token, password });
      return (response as unknown as { data: { reset: boolean } }).data;
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.response.data.name : 'reset-password-failed';
      return rejectWithValue(msg);
    }
  }
);

// ---------- Slice ----------

const resetPasswordDuck = createSlice({
  name: 'resetPassword',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(resetPasswordThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(resetPasswordThunk.fulfilled, (state) => {
        state.status = 'success';
      })
      .addCase(resetPasswordThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload as string;
      });
  },
});

export const resetPasswordDuckReducer = resetPasswordDuck.reducer;

// ---------- Selectors ----------

export const selectResetPasswordStatus = (state: RootState) => state.resetPassword.status;
export const selectResetPasswordError = (state: RootState) => state.resetPassword.error;

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

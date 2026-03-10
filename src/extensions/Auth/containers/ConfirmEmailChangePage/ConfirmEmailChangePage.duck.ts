import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { authApi } from '../../api/auth';

// ---------- Types ----------

interface ConfirmEmailChangeState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ---------- Initial state ----------

const initialState: ConfirmEmailChangeState = {
  status: 'idle',
  error: null,
};

// ---------- Thunks ----------

export const confirmEmailChangeThunk = createAppAsyncThunk(
  'confirmEmailChange/confirm',
  async ({ token }: { token: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.confirmEmailChange({ token });
      return (response as unknown as { data: { confirmed: boolean } }).data;
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.response.data.error?.code ?? 'unknown-error' : 'confirmation-failed';
      return rejectWithValue(msg);
    }
  }
);

// ---------- Slice ----------

const confirmEmailChangeDuck = createSlice({
  name: 'confirmEmailChange',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(confirmEmailChangeThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(confirmEmailChangeThunk.fulfilled, (state) => {
        state.status = 'success';
      })
      .addCase(confirmEmailChangeThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload as string;
      });
  },
});

export const confirmEmailChangeDuckReducer = confirmEmailChangeDuck.reducer;

// ---------- Selectors ----------

export const selectConfirmEmailChangeStatus = (state: RootState) => state.confirmEmailChange.status;
export const selectConfirmEmailChangeError = (state: RootState) => state.confirmEmailChange.error;

// ---------- Helpers ----------

function isApiError(
  err: unknown
): err is { response: { status: number; data: { error?: { code: string; message: string } } } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>)['response'] === 'object'
  );
}

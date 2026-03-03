import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { authApi } from '../../api/auth';
import { setCredentials } from '../../duck/authDuck';

// ---------- Types ----------

interface VerifyEmailState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  resendStatus: 'idle' | 'loading' | 'sent' | 'error';
}

// ---------- Initial state ----------

const initialState: VerifyEmailState = {
  status: 'idle',
  error: null,
  resendStatus: 'idle',
};

// ---------- Thunks ----------

export const verifyEmailThunk = createAppAsyncThunk(
  'verifyEmail/verify',
  async ({ token }: { token: string }, { dispatch, rejectWithValue }) => {
    try {
      const response = await authApi.verifyEmail({ token });
      const data = (response as unknown as { data: { user: object; accessToken: string } }).data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch(setCredentials({ user: data.user as any, accessToken: data.accessToken }));
      return data;
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.response.data.name : 'verification-failed';
      return rejectWithValue(msg);
    }
  }
);

export const resendVerificationThunk = createAppAsyncThunk(
  'verifyEmail/resend',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.resendVerification();
    } catch (err: unknown) {
      const msg = isApiError(err) ? err.response.data.name : 'resend-failed';
      return rejectWithValue(msg);
    }
  }
);

// ---------- Slice ----------

const verifyEmailDuck = createSlice({
  name: 'verifyEmail',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(verifyEmailThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(verifyEmailThunk.fulfilled, (state) => {
        state.status = 'success';
      })
      .addCase(verifyEmailThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload as string;
      })
      .addCase(resendVerificationThunk.pending, (state) => {
        state.resendStatus = 'loading';
      })
      .addCase(resendVerificationThunk.fulfilled, (state) => {
        state.resendStatus = 'sent';
      })
      .addCase(resendVerificationThunk.rejected, (state) => {
        state.resendStatus = 'error';
      });
  },
});

export const verifyEmailDuckReducer = verifyEmailDuck.reducer;

// ---------- Selectors ----------

export const selectVerifyStatus = (state: RootState) => state.verifyEmail.status;
export const selectVerifyError = (state: RootState) => state.verifyEmail.error;
export const selectResendStatus = (state: RootState) => state.verifyEmail.resendStatus;

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

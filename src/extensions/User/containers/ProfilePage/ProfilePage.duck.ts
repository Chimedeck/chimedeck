// Redux duck for ProfilePage — fetches and mutates the current user's profile.
import { createSlice, type PayloadAction, type SerializedError } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { userApi, type UserProfile } from '../../api/user';

// ---------- Types ----------

interface ProfileState {
  user: UserProfile | null;
  status: 'idle' | 'loading' | 'saving' | 'error';
  avatarUploading: boolean;
  error: SerializedError | null;
}

// ---------- Initial state ----------

const initialState: ProfileState = {
  user: null,
  status: 'idle',
  avatarUploading: false,
  error: null,
};

// ---------- Helpers ----------

function isApiError(err: unknown): err is { response: { data: { name: string } } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response: unknown }).response === 'object'
  );
}

// ---------- Thunks ----------

export const fetchProfileThunk = createAppAsyncThunk(
  'profile/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const res = await userApi.getProfile();
      return (res as unknown as { data: UserProfile }).data;
    } catch (err) {
      return rejectWithValue(isApiError(err) ? err.response.data.name : 'fetch-failed');
    }
  },
);

export const updateProfileThunk = createAppAsyncThunk(
  'profile/update',
  async ({ nickname, name }: { nickname?: string; name?: string }, { rejectWithValue }) => {
    try {
      const payload: { nickname?: string; name?: string } = {};
      if (nickname !== undefined) payload.nickname = nickname;
      if (name !== undefined) payload.name = name;
      const res = await userApi.updateProfile(payload);
      return (res as unknown as { data: UserProfile }).data;
    } catch (err) {
      return rejectWithValue(isApiError(err) ? err.response.data.name : 'update-failed');
    }
  },
);

export const uploadAvatarThunk = createAppAsyncThunk(
  'profile/uploadAvatar',
  async ({ file }: { file: File }, { rejectWithValue }) => {
    try {
      const res = await userApi.uploadAvatar({ file });
      return (res as unknown as { data: { avatar_url: string } }).data;
    } catch (err) {
      return rejectWithValue(isApiError(err) ? err.response.data.name : 'upload-failed');
    }
  },
);

export const removeAvatarThunk = createAppAsyncThunk(
  'profile/removeAvatar',
  async (_, { rejectWithValue }) => {
    try {
      await userApi.removeAvatar();
    } catch (err) {
      return rejectWithValue(isApiError(err) ? err.response.data.name : 'remove-failed');
    }
  },
);

// ---------- Slice ----------

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchProfile
      .addCase(fetchProfileThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProfileThunk.fulfilled, (state, action: PayloadAction<UserProfile>) => {
        state.status = 'idle';
        state.user = action.payload;
      })
      .addCase(fetchProfileThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error;
      })

      // updateProfile
      .addCase(updateProfileThunk.pending, (state) => {
        state.status = 'saving';
        state.error = null;
      })
      .addCase(updateProfileThunk.fulfilled, (state, action: PayloadAction<UserProfile>) => {
        state.status = 'idle';
        state.user = action.payload;
      })
      .addCase(updateProfileThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error;
      })

      // uploadAvatar
      .addCase(uploadAvatarThunk.pending, (state) => {
        state.avatarUploading = true;
      })
      .addCase(uploadAvatarThunk.fulfilled, (state, action: PayloadAction<{ avatar_url: string }>) => {
        state.avatarUploading = false;
        if (state.user) state.user.avatar_url = action.payload.avatar_url;
      })
      .addCase(uploadAvatarThunk.rejected, (state) => {
        state.avatarUploading = false;
      })

      // removeAvatar
      .addCase(removeAvatarThunk.pending, (state) => {
        state.avatarUploading = true;
      })
      .addCase(removeAvatarThunk.fulfilled, (state) => {
        state.avatarUploading = false;
        if (state.user) state.user.avatar_url = null;
      })
      .addCase(removeAvatarThunk.rejected, (state) => {
        state.avatarUploading = false;
      });
  },
});

export const profileDuckReducer = profileSlice.reducer;

// ---------- Selectors ----------

export const selectProfile = (state: RootState) => state.profile.user;
export const selectProfileStatus = (state: RootState) => state.profile.status;
export const selectAvatarUploading = (state: RootState) => state.profile.avatarUploading;
export const selectProfileError = (state: RootState) => state.profile.error;

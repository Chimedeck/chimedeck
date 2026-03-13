// Feature-flags slice — fetches client-safe flags from /api/v1/flags once on
// app boot (triggered by AppShell) and stores them for any component to read.
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { apiClient } from '~/common/api/client';

interface FeatureFlagsState {
  // Comma-separated list of admin email domains (mirrors server ADMIN_EMAIL_DOMAINS)
  adminEmailDomains: string;
  // Whether admin invite email sending is enabled
  adminInviteEmailEnabled: boolean;
  // Whether SES is enabled (required for invite emails and email notifications)
  sesEnabled: boolean;
  // Whether the notification preferences panel is shown in profile settings
  notificationPreferencesEnabled: boolean;
  // Whether email notification dispatch is enabled (Sprint 72)
  emailNotificationsEnabled: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: FeatureFlagsState = {
  adminEmailDomains: '',
  adminInviteEmailEnabled: false,
  sesEnabled: false,
  notificationPreferencesEnabled: false,
  emailNotificationsEnabled: false,
  status: 'idle',
};

export const fetchFeatureFlagsThunk = createAppAsyncThunk(
  'featureFlags/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<{
        data: {
          adminEmailDomains?: string;
          adminInviteEmailEnabled?: boolean;
          sesEnabled?: boolean;
          notificationPreferencesEnabled?: boolean;
          emailNotificationsEnabled?: boolean;
        };
      }>('/flags');
      return response.data;
    } catch {
      return rejectWithValue('flags-fetch-failed');
    }
  },
);

const featureFlagsSlice = createSlice({
  name: 'featureFlags',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeatureFlagsThunk.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchFeatureFlagsThunk.fulfilled, (state, action) => {
        state.adminEmailDomains = action.payload.adminEmailDomains ?? '';
        state.adminInviteEmailEnabled = action.payload.adminInviteEmailEnabled ?? false;
        state.sesEnabled = action.payload.sesEnabled ?? false;
        state.notificationPreferencesEnabled = action.payload.notificationPreferencesEnabled ?? false;
        state.emailNotificationsEnabled = action.payload.emailNotificationsEnabled ?? false;
        state.status = 'ready';
      })
      .addCase(fetchFeatureFlagsThunk.rejected, (state) => {
        state.status = 'error';
      });
  },
});

export const featureFlagsReducer = featureFlagsSlice.reducer;

export const selectAdminEmailDomains = (state: RootState) =>
  state.featureFlags.adminEmailDomains;
export const selectAdminInviteEmailEnabled = (state: RootState) =>
  state.featureFlags.adminInviteEmailEnabled;
export const selectSesEnabled = (state: RootState) => state.featureFlags.sesEnabled;
export const selectShowEmailToggle = (state: RootState) =>
  state.featureFlags.sesEnabled && state.featureFlags.adminInviteEmailEnabled;
export const selectNotificationPreferencesEnabled = (state: RootState) =>
  state.featureFlags.notificationPreferencesEnabled;
export const selectEmailNotificationsEnabled = (state: RootState) =>
  state.featureFlags.emailNotificationsEnabled;

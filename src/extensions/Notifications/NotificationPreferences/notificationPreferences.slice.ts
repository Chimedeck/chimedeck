// RTK Query slice for notification preferences — GET and PATCH endpoints.
// Uses createApi with fetchBaseQuery so cache invalidation works automatically
// when the user toggles a preference.
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '~/store';
import type { NotificationPreference, UpdatePreferencesBody } from './types';

export const notificationPreferencesApi = createApi({
  reducerPath: 'notificationPreferencesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    // [why] Attach Bearer token from Redux auth state so the API request is authenticated.
    prepareHeaders(headers, { getState }) {
      const token = (getState() as RootState).auth?.accessToken ?? null;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['NotificationPreferences'],
  endpoints: (builder) => ({
    getNotificationPreferences: builder.query<NotificationPreference[], void>({
      query: () => '/notifications/preferences',
      // Unwrap the { data: [...] } envelope returned by the server.
      transformResponse: (response: { data: NotificationPreference[] }) => response.data,
      providesTags: ['NotificationPreferences'],
    }),
    updateNotificationPreferences: builder.mutation<NotificationPreference[], UpdatePreferencesBody>({
      query: (body) => ({ url: '/notifications/preferences', method: 'PATCH', body }),
      transformResponse: (response: { data: NotificationPreference[] }) => response.data,
      invalidatesTags: ['NotificationPreferences'],
    }),
  }),
});

export const {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} = notificationPreferencesApi;

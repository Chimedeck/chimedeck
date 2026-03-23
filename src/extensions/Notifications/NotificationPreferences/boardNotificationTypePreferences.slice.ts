// RTK Query slice for board-level per-type notification preferences.
// Exposes GET, PATCH, and DELETE endpoints for the override matrix in BoardSettings.
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { NotificationType } from './types';

export interface ResolvedTypePreference {
  type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
  /** Tells the UI whether this value comes from a board override, user master config, or default. */
  source: 'board' | 'user' | 'default';
}

interface UpdateBoardTypePreferenceBody {
  type: NotificationType;
  in_app_enabled?: boolean;
  email_enabled?: boolean;
}

export const boardNotificationTypePreferencesApi = createApi({
  reducerPath: 'boardNotificationTypePreferencesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    // [why] Attach Bearer token from Redux auth state so the API request is authenticated.
    prepareHeaders(headers, { getState }) {
      const token = (getState() as { auth: { accessToken: string | null } }).auth?.accessToken ?? null;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['BoardNotificationTypePreferences'],
  endpoints: (builder) => ({
    getBoardTypePreferences: builder.query<ResolvedTypePreference[], { boardId: string }>({
      query: ({ boardId }) => `/boards/${boardId}/notification-preferences/types`,
      transformResponse: (res: { data: ResolvedTypePreference[] }) => res.data,
      providesTags: ['BoardNotificationTypePreferences'],
    }),
    updateBoardTypePreference: builder.mutation<
      ResolvedTypePreference[],
      { boardId: string } & UpdateBoardTypePreferenceBody
    >({
      query: ({ boardId, ...body }) => ({
        url: `/boards/${boardId}/notification-preferences/types`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: { data: ResolvedTypePreference[] }) => res.data,
      // [why] Invalidate so the cache refreshes with fresh source fields from the server.
      invalidatesTags: ['BoardNotificationTypePreferences'],
    }),
    resetBoardTypePreferences: builder.mutation<void, { boardId: string }>({
      query: ({ boardId }) => ({
        url: `/boards/${boardId}/notification-preferences/types`,
        method: 'DELETE',
      }),
      // [why] After reset, all source fields revert to 'user'/'default' — must re-fetch.
      invalidatesTags: ['BoardNotificationTypePreferences'],
    }),
  }),
});

export const {
  useGetBoardTypePreferencesQuery,
  useUpdateBoardTypePreferenceMutation,
  useResetBoardTypePreferencesMutation,
} = boardNotificationTypePreferencesApi;

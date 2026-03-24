// RTK Query slice for API token management — list, create, and revoke endpoints.
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface ApiTokenItem {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateTokenBody {
  name: string;
  expiresAt?: string | null;
}

export interface CreateTokenResponse {
  data: ApiTokenItem & { token: string };
}

export const apiTokenApi = createApi({
  reducerPath: 'apiTokenApi',
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
  tagTypes: ['ApiToken'],
  endpoints: (builder) => ({
    listTokens: builder.query<ApiTokenItem[], void>({
      query: () => '/tokens',
      transformResponse: (res: { data: ApiTokenItem[] }) => res.data,
      providesTags: ['ApiToken'],
    }),
    createToken: builder.mutation<CreateTokenResponse, CreateTokenBody>({
      query: (body) => ({ url: '/tokens', method: 'POST', body }),
      invalidatesTags: ['ApiToken'],
    }),
    revokeToken: builder.mutation<void, string>({
      query: (id) => ({ url: `/tokens/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ApiToken'],
    }),
  }),
});

export const { useListTokensQuery, useCreateTokenMutation, useRevokeTokenMutation } = apiTokenApi;

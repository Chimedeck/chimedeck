// RTK Query slice for webhook management — list, create, update, delete, and event-types endpoints.
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface WebhookItem {
  id: string;
  label: string;
  endpointUrl: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateWebhookBody {
  workspaceId: string;
  label: string;
  endpointUrl: string;
  eventTypes: string[];
}

export interface UpdateWebhookBody {
  label?: string;
  endpointUrl?: string;
  eventTypes?: string[];
  isActive?: boolean;
}

export interface CreateWebhookResponse {
  data: WebhookItem & { signingSecret: string };
}

export const webhooksApi = createApi({
  reducerPath: 'webhooksApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    credentials: 'include',
    // [why] Attach Bearer token from Redux auth state so the API request is authenticated.
    prepareHeaders(headers, { getState }) {
      const token = (getState() as { auth: { accessToken: string | null } }).auth?.accessToken ?? null;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Webhook'],
  endpoints: (builder) => ({
    listWebhooks: builder.query<WebhookItem[], string>({
      query: (workspaceId) => `/webhooks?workspaceId=${workspaceId}`,
      transformResponse: (res: { data: WebhookItem[] }) => res.data,
      providesTags: ['Webhook'],
    }),
    createWebhook: builder.mutation<CreateWebhookResponse, CreateWebhookBody>({
      query: (body) => ({ url: '/webhooks', method: 'POST', body }),
      invalidatesTags: ['Webhook'],
    }),
    updateWebhook: builder.mutation<{ data: WebhookItem }, { id: string } & UpdateWebhookBody>({
      query: ({ id, ...body }) => ({ url: `/webhooks/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Webhook'],
    }),
    deleteWebhook: builder.mutation<void, string>({
      query: (id) => ({ url: `/webhooks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Webhook'],
    }),
    listEventTypes: builder.query<string[], void>({
      query: () => '/webhooks/event-types',
      transformResponse: (res: { data: string[] }) => res.data,
    }),
  }),
});

export const {
  useListWebhooksQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useListEventTypesQuery,
} = webhooksApi;

// boardGuestsSlice — RTK Query slice for board guest CRUD.
// Endpoints: GET /api/v1/boards/:boardId/guests
//            POST /api/v1/boards/:boardId/guests  (invite by email)
//            DELETE /api/v1/boards/:boardId/guests/:userId
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface BoardGuest {
  id: string;
  email: string;
  name: string;
  granted_at: string;
  granted_by: string;
}

export const boardGuestsApi = createApi({
  reducerPath: 'boardGuestsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    // [why] Attach Bearer token from Redux auth state for authenticated requests.
    prepareHeaders(headers, { getState }) {
      const token = (getState() as { auth: { accessToken: string | null } }).auth?.accessToken ?? null;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['BoardGuests'],
  endpoints: (builder) => ({
    // GET /api/v1/boards/:boardId/guests
    getBoardGuests: builder.query<BoardGuest[], string>({
      query: (boardId) => `/boards/${boardId}/guests`,
      transformResponse: (response: { data: BoardGuest[] }) => response.data,
      providesTags: (_result, _err, boardId) => [{ type: 'BoardGuests', id: boardId }],
    }),

    // POST /api/v1/boards/:boardId/guests — invite by email
    inviteBoardGuest: builder.mutation<BoardGuest, { boardId: string; email: string }>({
      query: ({ boardId, email }) => ({
        url: `/boards/${boardId}/guests`,
        method: 'POST',
        body: { email },
      }),
      transformResponse: (response: { data: BoardGuest }) => response.data,
      invalidatesTags: (_result, _err, { boardId }) => [{ type: 'BoardGuests', id: boardId }],
    }),

    // DELETE /api/v1/boards/:boardId/guests/:userId
    revokeBoardGuest: builder.mutation<void, { boardId: string; userId: string }>({
      query: ({ boardId, userId }) => ({
        url: `/boards/${boardId}/guests/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _err, { boardId }) => [{ type: 'BoardGuests', id: boardId }],
    }),
  }),
});

export const {
  useGetBoardGuestsQuery,
  useInviteBoardGuestMutation,
  useRevokeBoardGuestMutation,
} = boardGuestsApi;

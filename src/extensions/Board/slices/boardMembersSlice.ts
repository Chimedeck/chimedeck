// boardMembersSlice — RTK Query slice for board member CRUD.
// Endpoints: GET, POST, PATCH, DELETE /api/v1/boards/:boardId/members
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type BoardMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface BoardMember {
  board_id: string;
  user_id: string;
  role: BoardMemberRole;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface AddBoardMemberBody {
  userId: string;
  role: BoardMemberRole;
}

interface UpdateBoardMemberBody {
  role: BoardMemberRole;
}

export const boardMembersApi = createApi({
  reducerPath: 'boardMembersApi',
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
  tagTypes: ['BoardMembers'],
  endpoints: (builder) => ({
    // GET /api/v1/boards/:boardId/members
    getBoardMembers: builder.query<BoardMember[], string>({
      query: (boardId) => `/boards/${boardId}/members`,
      transformResponse: (response: { data: BoardMember[] }) => response.data,
      providesTags: (_result, _err, boardId) => [{ type: 'BoardMembers', id: boardId }],
    }),

    // POST /api/v1/boards/:boardId/members
    addBoardMember: builder.mutation<BoardMember, { boardId: string } & AddBoardMemberBody>({
      query: ({ boardId, ...body }) => ({
        url: `/boards/${boardId}/members`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: BoardMember }) => response.data,
      invalidatesTags: (_result, _err, { boardId }) => [{ type: 'BoardMembers', id: boardId }],
    }),

    // PATCH /api/v1/boards/:boardId/members/:userId
    updateBoardMember: builder.mutation<
      BoardMember,
      { boardId: string; userId: string } & UpdateBoardMemberBody
    >({
      query: ({ boardId, userId, ...body }) => ({
        url: `/boards/${boardId}/members/${userId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: { data: BoardMember }) => response.data,
      invalidatesTags: (_result, _err, { boardId }) => [{ type: 'BoardMembers', id: boardId }],
    }),

    // DELETE /api/v1/boards/:boardId/members/:userId
    removeBoardMember: builder.mutation<void, { boardId: string; userId: string }>({
      query: ({ boardId, userId }) => ({
        url: `/boards/${boardId}/members/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _err, { boardId }) => [{ type: 'BoardMembers', id: boardId }],
    }),

    // POST /api/v1/boards/:boardId/members/join — self-join a WORKSPACE or PUBLIC board
    joinBoard: builder.mutation<BoardMember, string>({
      query: (boardId) => ({
        url: `/boards/${boardId}/members/join`,
        method: 'POST',
      }),
      transformResponse: (response: { data: BoardMember }) => response.data,
      invalidatesTags: (_result, _err, boardId) => [{ type: 'BoardMembers', id: boardId }],
    }),
  }),
});

export const {
  useGetBoardMembersQuery,
  useAddBoardMemberMutation,
  useUpdateBoardMemberMutation,
  useRemoveBoardMemberMutation,
  useJoinBoardMutation,
} = boardMembersApi;

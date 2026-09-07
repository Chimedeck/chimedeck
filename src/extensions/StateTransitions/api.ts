import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AppDispatch } from '~/store';
import type { ActionTypeId } from './config/actionTypes';

export type StateTransitionAction = ActionTypeId;
export type StateTransitionDirection = 'one_way' | 'two_way';
export type StateTransitionStyle = 'straight' | 'orthogonal' | 'smooth' | 'curved';

export interface StateTransitionWaypoint {
  x: number;
  y: number;
}

export interface StateTransitionNode {
  id: string;
  listId: string;
  label: string;
  positionX: number;
  positionY: number;
}

export interface StateTransitionEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  connectorOffsetX?: number;
  connectorOffsetY?: number;
  waypoints?: StateTransitionWaypoint[];
  action: StateTransitionAction;
  direction: StateTransitionDirection;
  style: StateTransitionStyle;
  label?: string;
}

export interface StateTransitionNote {
  id: string;
  content: string;
  positionX: number;
  positionY: number;
}

export interface StateTransitionGraph {
  nodes: StateTransitionNode[];
  edges: StateTransitionEdge[];
  notes: StateTransitionNote[];
}

export interface StateTransitionsResponse {
  data: {
    boardId: string;
    enabled: boolean;
    graph: StateTransitionGraph;
    updatedAt: string;
  };
}

export interface CopyStateTransitionsResponse {
  data: {
    boardId: string;
    enabled: boolean;
    graph: StateTransitionGraph;
    updatedAt: string;
  };
  metadata: {
    skippedNodes: number;
    copyEnabled: boolean;
  };
}

export interface StateTransitionRule {
  currentState: string;
  currentStateId: string;
  allowedNextStates: string[];
  allowedNextStateIds: string[];
  forbiddenNextStates: string[];
  forbiddenNextStateIds: string[];
}

export interface StateTransitionRulesResponse {
  data: {
    boardId: string;
    enabled: boolean;
    rules: StateTransitionRule[];
  };
}

export interface PutStateTransitionsInput {
  boardId: string;
  enabled?: boolean;
  graph?: StateTransitionGraph;
}

export interface CreateBoardListInput {
  boardId: string;
  title: string;
  afterId?: string | null;
}

export interface BoardListResponse {
  data: {
    id: string;
    boardId: string;
    title: string;
    position: string;
    archived: boolean;
    color?: string | null;
  };
}

export interface CopyStateTransitionsInput {
  boardId: string;
  targetBoardId: string;
  copyEnabled: boolean;
}

export const stateTransitionsApi = createApi({
  reducerPath: 'stateTransitionsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    credentials: 'include',
    // [why] Keep auth behavior consistent with other RTK query slices.
    prepareHeaders(headers, { getState }) {
      const token = (getState() as { auth: { accessToken: string | null } }).auth.accessToken ?? null;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['StateTransitions'],
  endpoints: (builder) => ({
    getStateTransitions: builder.query<StateTransitionsResponse['data'], string>({
      query: (boardId) => `/boards/${boardId}/state-transitions`,
      transformResponse: (response: StateTransitionsResponse) => response.data,
      providesTags: (_result, _error, boardId) => [{ type: 'StateTransitions', id: boardId }],
    }),
    getStateTransitionRules: builder.query<StateTransitionRulesResponse['data'], string>({
      query: (boardId) => `/boards/${boardId}/state-transitions/rules`,
      transformResponse: (response: StateTransitionRulesResponse) => response.data,
      providesTags: (_result, _error, boardId) => [{ type: 'StateTransitions', id: boardId }],
    }),
    putStateTransitions: builder.mutation<StateTransitionsResponse['data'], PutStateTransitionsInput>({
      query: ({ boardId, ...payload }) => ({
        url: `/boards/${boardId}/state-transitions`,
        method: 'PUT',
        body: payload,
      }),
      transformResponse: (response: StateTransitionsResponse) => response.data,
      invalidatesTags: (_result, _error, { boardId }) => [{ type: 'StateTransitions', id: boardId }],
    }),
    createBoardList: builder.mutation<BoardListResponse['data'], CreateBoardListInput>({
      query: ({ boardId, title, afterId }) => ({
        url: `/boards/${boardId}/lists`,
        method: 'POST',
        body: { title, ...(afterId !== undefined ? { afterId } : {}) },
      }),
      transformResponse: (response: BoardListResponse) => response.data,
    }),
    copyStateTransitions: builder.mutation<CopyStateTransitionsResponse, CopyStateTransitionsInput>({
      query: ({ boardId, targetBoardId, copyEnabled }) => ({
        url: `/boards/${boardId}/state-transitions/copy`,
        method: 'POST',
        body: { targetBoardId, copyEnabled },
      }),
      invalidatesTags: (_result, _error, { boardId, targetBoardId }) => [
        { type: 'StateTransitions', id: boardId },
        { type: 'StateTransitions', id: targetBoardId },
      ],
    }),
  }),
});

export function invalidateStateTransitionsBoardCache(dispatch: AppDispatch, boardId: string): void {
  dispatch(
    stateTransitionsApi.util.invalidateTags([
      { type: 'StateTransitions', id: boardId },
    ]),
  );
}

export const {
  useGetStateTransitionsQuery,
  useGetStateTransitionRulesQuery,
  usePutStateTransitionsMutation,
  useCreateBoardListMutation,
  useCopyStateTransitionsMutation,
} = stateTransitionsApi;

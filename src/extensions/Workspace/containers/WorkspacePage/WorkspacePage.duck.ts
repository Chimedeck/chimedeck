// Redux duck for workspace state — actions, thunks, reducers, and selectors.
import {
  createSelector,
  createSlice,
  type PayloadAction,
  type SerializedError,
} from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  createInvite,
  addMember,
  listMembers,
  updateMemberRole,
  removeMember,
  type Role,
  type Workspace,
  type WorkspaceMember,
} from '../../api';

// ---------- State ----------

interface WorkspacePageState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  members: WorkspaceMember[];

  fetchWorkspacesInProgress: boolean;
  fetchWorkspacesError: SerializedError | null;

  fetchWorkspaceInProgress: boolean;
  fetchWorkspaceError: SerializedError | null;

  fetchMembersInProgress: boolean;
  fetchMembersError: SerializedError | null;

  createWorkspaceInProgress: boolean;
  createWorkspaceError: SerializedError | null;

  updateWorkspaceInProgress: boolean;
  updateWorkspaceError: SerializedError | null;

  deleteWorkspaceInProgress: boolean;
  deleteWorkspaceError: SerializedError | null;

  inviteInProgress: boolean;
  inviteError: SerializedError | null;
  inviteSuccess: boolean;

  updateRoleInProgress: boolean;
  updateRoleError: SerializedError | null;

  removeInProgress: boolean;
  removeError: SerializedError | null;
}

const initialState: WorkspacePageState = {
  workspaces: [],
  currentWorkspace: null,
  members: [],

  fetchWorkspacesInProgress: false,
  fetchWorkspacesError: null,

  fetchWorkspaceInProgress: false,
  fetchWorkspaceError: null,

  fetchMembersInProgress: false,
  fetchMembersError: null,

  createWorkspaceInProgress: false,
  createWorkspaceError: null,

  updateWorkspaceInProgress: false,
  updateWorkspaceError: null,

  deleteWorkspaceInProgress: false,
  deleteWorkspaceError: null,

  inviteInProgress: false,
  inviteError: null,
  inviteSuccess: false,

  updateRoleInProgress: false,
  updateRoleError: null,

  removeInProgress: false,
  removeError: null,
};

// ---------- Thunks ----------

export const fetchWorkspaces = createAppAsyncThunk(
  'WorkspacePage/fetchWorkspaces',
  async (_, { extra: { api } }) => {
    const response = await listWorkspaces({ api });
    return response.data;
  }
);

export const fetchWorkspace = createAppAsyncThunk(
  'WorkspacePage/fetchWorkspace',
  async ({ workspaceId }: { workspaceId: string }, { extra: { api } }) => {
    const [workspace, membersResponse] = await Promise.all([
      getWorkspace({ api, workspaceId }),
      listMembers({ api, workspaceId }),
    ]);
    return { workspace: workspace.data, members: membersResponse.data };
  }
);

export const fetchWorkspaceMembersThunk = createAppAsyncThunk(
  'WorkspacePage/fetchWorkspaceMembers',
  async ({ workspaceId }: { workspaceId: string }, { extra: { api } }) => {
    const response = await listMembers({ api, workspaceId });
    return response.data;
  }
);

export const createWorkspaceThunk = createAppAsyncThunk(
  'WorkspacePage/createWorkspace',
  async ({ name }: { name: string }, { extra: { api } }) => {
    const response = await createWorkspace({ api, name });
    return response.data;
  }
);

export const updateWorkspaceThunk = createAppAsyncThunk(
  'WorkspacePage/updateWorkspace',
  async (
    { workspaceId, name }: { workspaceId: string; name: string },
    { extra: { api } }
  ) => {
    const response = await updateWorkspace({ api, workspaceId, name });
    return response.data;
  }
);

export const deleteWorkspaceThunk = createAppAsyncThunk(
  'WorkspacePage/deleteWorkspace',
  async ({ workspaceId }: { workspaceId: string }, { extra: { api } }) => {
    const response = await deleteWorkspace({ api, workspaceId });
    return response.data;
  }
);

export const sendInvite = createAppAsyncThunk(
  'WorkspacePage/sendInvite',
  async (
    {
      workspaceId,
      email,
      role,
    }: { workspaceId: string; email: string; role: Role },
    { extra: { api } }
  ) => {
    const response = await createInvite({ api, workspaceId, email, role });
    return response.data;
  }
);

export const addMemberThunk = createAppAsyncThunk(
  'WorkspacePage/addMember',
  async (
    {
      workspaceId,
      email,
      role,
    }: { workspaceId: string; email: string; role: Role },
    { extra: { api } }
  ) => {
    const response = await addMember({ api, workspaceId, email, role });
    return response.data;
  }
);

export const updateMemberRoleThunk = createAppAsyncThunk(
  'WorkspacePage/updateMemberRole',
  async (
    {
      workspaceId,
      userId,
      role,
    }: { workspaceId: string; userId: string; role: Role },
    { extra: { api } }
  ) => {
    const response = await updateMemberRole({ api, workspaceId, userId, role });
    return response.data;
  }
);

export const removeMemberThunk = createAppAsyncThunk(
  'WorkspacePage/removeMember',
  async (
    { workspaceId, userId }: { workspaceId: string; userId: string },
    { extra: { api } }
  ) => {
    await removeMember({ api, workspaceId, userId });
    // Server returns 204 No Content — return the userId so the reducer can filter by it
    return userId;
  }
);

// loadData is the route-level data fetcher called before the page renders.
export const loadData = createAppAsyncThunk(
  'WorkspacePage/loadData',
  async (
    { params }: { params: { workspaceId?: string } },
    { dispatch }
  ) => {
    await dispatch(fetchWorkspaces()).unwrap();
    if (params.workspaceId) {
      await dispatch(fetchWorkspace({ workspaceId: params.workspaceId })).unwrap();
    }
  }
);

// ---------- Slice ----------

const WorkspacePageSlice = createSlice({
  name: 'WorkspacePage',
  initialState,
  reducers: {
    clearInviteState(state) {
      state.inviteError = null;
      state.inviteSuccess = false;
    },
    clearErrors(state) {
      state.fetchWorkspacesError = null;
      state.fetchWorkspaceError = null;
      state.fetchMembersError = null;
      state.createWorkspaceError = null;
      state.updateWorkspaceError = null;
      state.deleteWorkspaceError = null;
      state.inviteError = null;
      state.updateRoleError = null;
      state.removeError = null;
    },
  },
  extraReducers(builder) {
    // fetchWorkspaces
    builder
      .addCase(fetchWorkspaces.pending, (state) => {
        state.fetchWorkspacesInProgress = true;
        state.fetchWorkspacesError = null;
      })
      .addCase(fetchWorkspaces.fulfilled, (state, action) => {
        state.fetchWorkspacesInProgress = false;
        state.workspaces = action.payload;
      })
      .addCase(fetchWorkspaces.rejected, (state, action) => {
        state.fetchWorkspacesInProgress = false;
        state.fetchWorkspacesError = action.error;
      });

    // fetchWorkspace (workspace + members)
    builder
      .addCase(fetchWorkspace.pending, (state) => {
        state.fetchWorkspaceInProgress = true;
        state.fetchWorkspaceError = null;
        // Keep existing workspace/members visible during refetch so the page stays stable
      })
      .addCase(fetchWorkspace.fulfilled, (state, action) => {
        state.fetchWorkspaceInProgress = false;
        state.currentWorkspace = action.payload.workspace;
        state.members = action.payload.members;
      })
      .addCase(fetchWorkspace.rejected, (state, action) => {
        state.fetchWorkspaceInProgress = false;
        state.fetchWorkspaceError = action.error;
      });

    // fetchWorkspaceMembers (members only — used by BoardMembersPanel when workspace wasn't pre-loaded)
    builder
      .addCase(fetchWorkspaceMembersThunk.pending, (state) => {
        state.fetchMembersInProgress = true;
        state.fetchMembersError = null;
      })
      .addCase(fetchWorkspaceMembersThunk.fulfilled, (state, action) => {
        state.fetchMembersInProgress = false;
        state.members = action.payload;
      })
      .addCase(fetchWorkspaceMembersThunk.rejected, (state, action) => {
        state.fetchMembersInProgress = false;
        state.fetchMembersError = action.error;
      });

    // createWorkspace
    builder
      .addCase(createWorkspaceThunk.pending, (state) => {
        state.createWorkspaceInProgress = true;
        state.createWorkspaceError = null;
      })
      .addCase(createWorkspaceThunk.fulfilled, (state, action) => {
        state.createWorkspaceInProgress = false;
        state.workspaces.push(action.payload);
      })
      .addCase(createWorkspaceThunk.rejected, (state, action) => {
        state.createWorkspaceInProgress = false;
        state.createWorkspaceError = action.error;
      });

    // updateWorkspace
    builder
      .addCase(updateWorkspaceThunk.pending, (state) => {
        state.updateWorkspaceInProgress = true;
        state.updateWorkspaceError = null;
      })
      .addCase(updateWorkspaceThunk.fulfilled, (state, action) => {
        state.updateWorkspaceInProgress = false;
        const updated = action.payload;
        if (state.currentWorkspace?.id === updated.id) {
          state.currentWorkspace = updated;
        }
        const idx = state.workspaces.findIndex((w) => w.id === updated.id);
        if (idx !== -1) state.workspaces[idx] = updated;
      })
      .addCase(updateWorkspaceThunk.rejected, (state, action) => {
        state.updateWorkspaceInProgress = false;
        state.updateWorkspaceError = action.error;
      });

    // deleteWorkspace
    builder
      .addCase(deleteWorkspaceThunk.pending, (state) => {
        state.deleteWorkspaceInProgress = true;
        state.deleteWorkspaceError = null;
      })
      .addCase(deleteWorkspaceThunk.fulfilled, (state, action) => {
        state.deleteWorkspaceInProgress = false;
        const deleted = action.payload;
        state.workspaces = state.workspaces.filter((w) => w.id !== deleted.id);
        if (state.currentWorkspace?.id === deleted.id) {
          state.currentWorkspace = null;
          state.members = [];
        }
      })
      .addCase(deleteWorkspaceThunk.rejected, (state, action) => {
        state.deleteWorkspaceInProgress = false;
        state.deleteWorkspaceError = action.error;
      });

    // sendInvite
    builder
      .addCase(sendInvite.pending, (state) => {
        state.inviteInProgress = true;
        state.inviteError = null;
        state.inviteSuccess = false;
      })
      .addCase(sendInvite.fulfilled, (state) => {
        state.inviteInProgress = false;
        state.inviteSuccess = true;
      })
      .addCase(sendInvite.rejected, (state, action) => {
        state.inviteInProgress = false;
        state.inviteError = action.error;
      });

    // updateMemberRole
    builder
      .addCase(updateMemberRoleThunk.pending, (state) => {
        state.updateRoleInProgress = true;
        state.updateRoleError = null;
      })
      .addCase(
        updateMemberRoleThunk.fulfilled,
        (state, action: PayloadAction<WorkspaceMember>) => {
          state.updateRoleInProgress = false;
          const updated = action.payload;
          const idx = state.members.findIndex((m) => m.userId === updated.userId);
          if (idx !== -1) state.members[idx] = updated;
        }
      )
      .addCase(updateMemberRoleThunk.rejected, (state, action) => {
        state.updateRoleInProgress = false;
        state.updateRoleError = action.error;
      });

    // removeMember
    builder
      .addCase(removeMemberThunk.pending, (state) => {
        state.removeInProgress = true;
        state.removeError = null;
      })
      .addCase(
        removeMemberThunk.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.removeInProgress = false;
          state.members = state.members.filter(
            (m) => m.userId !== action.payload
          );
        }
      )
      .addCase(removeMemberThunk.rejected, (state, action) => {
        state.removeInProgress = false;
        state.removeError = action.error;
      });
  },
});

export const { clearInviteState, clearErrors } = WorkspacePageSlice.actions;

export default WorkspacePageSlice.reducer;

// ---------- Selectors ----------

const workspacePageState = (state: RootState) =>
  (state as unknown as { WorkspacePage: WorkspacePageState }).WorkspacePage;

export const workspacesSelector = createSelector(
  workspacePageState,
  (s) => s.workspaces
);

export const currentWorkspaceSelector = createSelector(
  workspacePageState,
  (s) => s.currentWorkspace
);

export const membersSelector = createSelector(
  workspacePageState,
  (s) => s.members
);

export const fetchWorkspacesInProgressSelector = createSelector(
  workspacePageState,
  (s) => s.fetchWorkspacesInProgress
);

export const fetchWorkspaceInProgressSelector = createSelector(
  workspacePageState,
  (s) => s.fetchWorkspaceInProgress
);

export const fetchWorkspaceErrorSelector = createSelector(
  workspacePageState,
  (s) => s.fetchWorkspaceError
);

export const inviteInProgressSelector = createSelector(
  workspacePageState,
  (s) => s.inviteInProgress
);

export const inviteErrorSelector = createSelector(
  workspacePageState,
  (s) => s.inviteError
);

export const inviteSuccessSelector = createSelector(
  workspacePageState,
  (s) => s.inviteSuccess
);

export const updateRoleInProgressSelector = createSelector(
  workspacePageState,
  (s) => s.updateRoleInProgress
);

export const updateRoleErrorSelector = createSelector(
  workspacePageState,
  (s) => s.updateRoleError
);

export const removeInProgressSelector = createSelector(
  workspacePageState,
  (s) => s.removeInProgress
);

export const removeErrorSelector = createSelector(
  workspacePageState,
  (s) => s.removeError
);

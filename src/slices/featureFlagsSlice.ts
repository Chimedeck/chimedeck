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
  // Whether email address verification is required on registration (Sprint 74)
  emailVerificationEnabled: boolean;
  // Whether enforceable state transitions UI/API are enabled
  stateTransitionsEnabled: boolean;
  // Whether workspace subscription/billing UI and gating are enabled
  subscriptionsEnabled: boolean;
  // Whether the board-chat *embedding* path is enabled. Independent of
  // boardChatEnabled — chat can stay on while semantic retrieval is off
  // (e.g. Ollama Cloud has chat models but no /v1/embeddings endpoint).
  chatEmbeddingEnabled: boolean;
  // Whether board chat UI/API should be enabled
  boardChatEnabled: boolean;
  // Whether GitHub-backed documentation editing should be enabled
  githubEditingEnabled: boolean;
  // Whether card-scoped inner chat (AI Assist refinement loop) is enabled
  innerCardChatEnabled: boolean;
  // Whether the agentic workflow pipeline (phase triggers, AI context/edit/sprint-gen) is enabled
  agenticWorkflowEnabled: boolean;
  // Whether AI context gathering (gather + file-scope) is enabled
  aiContextEnabled: boolean;
  // Whether AI edit orchestrator (Sprint 175) is enabled
  aiEditEnabled: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: FeatureFlagsState = {
  adminEmailDomains: '',
  adminInviteEmailEnabled: false,
  sesEnabled: false,
  notificationPreferencesEnabled: false,
  emailNotificationsEnabled: false,
  emailVerificationEnabled: false,
  stateTransitionsEnabled: false,
  subscriptionsEnabled: false,
  // [why] Default true so existing deployments don't suddenly lose semantic
  // retrieval after upgrading. Operators who run Ollama Cloud (or any
  // embedding-less provider) should set CHAT_EMBEDDING_ENABLED=false.
  chatEmbeddingEnabled: true,
  boardChatEnabled: false,
  githubEditingEnabled: false,
  innerCardChatEnabled: false,
  agenticWorkflowEnabled: false,
  aiContextEnabled: false,
  aiEditEnabled: false,
  status: 'idle',
};

export const fetchFeatureFlagsThunk = createAppAsyncThunk(
  'featureFlags/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get<
        | {
          data: {
            adminEmailDomains?: string;
            adminInviteEmailEnabled?: boolean;
            sesEnabled?: boolean;
            notificationPreferencesEnabled?: boolean;
            emailNotificationsEnabled?: boolean;
            emailVerificationEnabled?: boolean;
            stateTransitionsEnabled?: boolean;
            subscriptionsEnabled?: boolean;
            chatEmbeddingEnabled?: boolean;
            boardChatEnabled?: boolean;
            githubEditingEnabled?: boolean;
            innerCardChatEnabled?: boolean;
            agenticWorkflowEnabled?: boolean;
            aiContextEnabled?: boolean;
            aiEditEnabled?: boolean;
          };
        }
        | {
          adminEmailDomains?: string;
          adminInviteEmailEnabled?: boolean;
          sesEnabled?: boolean;
          notificationPreferencesEnabled?: boolean;
          emailNotificationsEnabled?: boolean;
          emailVerificationEnabled?: boolean;
          stateTransitionsEnabled?: boolean;
          subscriptionsEnabled?: boolean;
          chatEmbeddingEnabled?: boolean;
          boardChatEnabled?: boolean;
          githubEditingEnabled?: boolean;
          innerCardChatEnabled?: boolean;
          agenticWorkflowEnabled?: boolean;
          aiContextEnabled?: boolean;
          aiEditEnabled?: boolean;
        }
      >('/flags');

      // apiClient auto-unwraps Axios responses, but keep compatibility with wrapped shapes.
      // [why] Narrow the union type — apiClient.get can return { data: {...} } | {...} | AxiosResponse.
      const payload = (() => {
        if (response && typeof response === 'object' && 'data' in response && response.data) {
          return response.data as Record<string, unknown>;
        }
        return response as Record<string, unknown>;
      })();
      return payload as {
        adminEmailDomains?: string;
        adminInviteEmailEnabled?: boolean;
        sesEnabled?: boolean;
        notificationPreferencesEnabled?: boolean;
        emailNotificationsEnabled?: boolean;
        emailVerificationEnabled?: boolean;
        stateTransitionsEnabled?: boolean;
        subscriptionsEnabled?: boolean;
        chatEmbeddingEnabled?: boolean;
        boardChatEnabled?: boolean;
        githubEditingEnabled?: boolean;
        innerCardChatEnabled?: boolean;
        agenticWorkflowEnabled?: boolean;
        aiContextEnabled?: boolean;
        aiEditEnabled?: boolean;
      };
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
        const payload = action.payload ?? {};
        state.adminEmailDomains = payload.adminEmailDomains ?? '';
        state.adminInviteEmailEnabled = payload.adminInviteEmailEnabled ?? false;
        state.sesEnabled = payload.sesEnabled ?? false;
        state.notificationPreferencesEnabled = payload.notificationPreferencesEnabled ?? false;
        state.emailNotificationsEnabled = payload.emailNotificationsEnabled ?? false;
        state.emailVerificationEnabled = payload.emailVerificationEnabled ?? false;
        state.stateTransitionsEnabled = payload.stateTransitionsEnabled ?? false;
        state.subscriptionsEnabled = payload.subscriptionsEnabled ?? false;
        state.chatEmbeddingEnabled = payload.chatEmbeddingEnabled ?? true;
        state.boardChatEnabled = payload.boardChatEnabled ?? false;
        state.githubEditingEnabled = payload.githubEditingEnabled ?? false;
        state.innerCardChatEnabled = payload.innerCardChatEnabled ?? false;
        state.agenticWorkflowEnabled = payload.agenticWorkflowEnabled ?? false;
        state.aiContextEnabled = payload.aiContextEnabled ?? false;
        state.aiEditEnabled = payload.aiEditEnabled ?? false;
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
export const selectEmailVerificationEnabled = (state: RootState) =>
  state.featureFlags.emailVerificationEnabled;
export const selectStateTransitionsEnabled = (state: RootState) =>
  state.featureFlags.stateTransitionsEnabled;
export const selectSubscriptionsEnabled = (state: RootState) =>
  state.featureFlags.subscriptionsEnabled;
export const selectChatEmbeddingEnabled = (state: RootState) =>
  state.featureFlags.chatEmbeddingEnabled;
export const selectBoardChatEnabled = (state: RootState) =>
  state.featureFlags.boardChatEnabled;
export const selectGithubEditingEnabled = (state: RootState) =>
  state.featureFlags.githubEditingEnabled;
export const selectInnerCardChatEnabled = (state: RootState) =>
  state.featureFlags.innerCardChatEnabled;
export const selectAgenticWorkflowEnabled = (state: RootState) =>
  state.featureFlags.agenticWorkflowEnabled;
export const selectAiContextEnabled = (state: RootState) =>
  state.featureFlags.aiContextEnabled;
export const selectAiEditEnabled = (state: RootState) =>
  state.featureFlags.aiEditEnabled;
export const selectFeatureFlagsStatus = (state: RootState) =>
  state.featureFlags.status;

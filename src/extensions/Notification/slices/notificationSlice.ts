// notificationSlice — Redux slice for in-app notification state.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { notificationApi, type Notification, type NotificationCommentReaction } from '../api';

// ---------- State ----------

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'error';
  hasMore: boolean;
  cursor: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  status: 'idle',
  hasMore: false,
  cursor: null,
};

// ---------- Thunks ----------

export const fetchNotificationsThunk = createAppAsyncThunk(
  'notifications/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationApi.list({ limit: 20 });
    } catch {
      return rejectWithValue('fetch-failed');
    }
  },
);

export const fetchMoreNotificationsThunk = createAppAsyncThunk(
  'notifications/fetchMore',
  async (_, { getState, rejectWithValue }) => {
    const cursor = getState().notifications.cursor;
    try {
      return await notificationApi.list({ limit: 20, cursor });
    } catch {
      return rejectWithValue('fetch-more-failed');
    }
  },
);

export const markReadThunk = createAppAsyncThunk(
  'notifications/markRead',
  async ({ id }: { id: string }, { rejectWithValue }) => {
    try {
      await notificationApi.markRead({ id });
      return id;
    } catch {
      return rejectWithValue('mark-read-failed');
    }
  },
);

export const markAllReadThunk = createAppAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationApi.markAllRead();
    } catch {
      return rejectWithValue('mark-all-read-failed');
    }
  },
);

export const deleteNotificationThunk = createAppAsyncThunk(
  'notifications/delete',
  async ({ id }: { id: string }, { rejectWithValue }) => {
    try {
      await notificationApi.deleteOne({ id });
      return id;
    } catch {
      return rejectWithValue('delete-failed');
    }
  },
);

export const clearAllNotificationsThunk = createAppAsyncThunk(
  'notifications/clearAll',
  async (_, { rejectWithValue }) => {
    try {
      await notificationApi.deleteAll();
    } catch {
      return rejectWithValue('clear-all-failed');
    }
  },
);

// ---------- Slice ----------

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Called by useNotificationSync when a WS notification_created event arrives
    addNotification(state, action: PayloadAction<Notification>) {
      const exists = state.notifications.some((n) => n.id === action.payload.id);
      if (!exists) {
        state.notifications.unshift(action.payload);
        if (!action.payload.read) {
          state.unreadCount += 1;
        }
      }
    },

    // Keeps comment reactions in Redux so close/reopen preserves optimistic updates.
    setNotificationCommentReactions(
      state,
      action: PayloadAction<{ id: string; reactions: NotificationCommentReaction[] }>,
    ) {
      const notification = state.notifications.find((item) => item.id === action.payload.id);
      if (!notification) return;
      notification.comment_reactions = action.payload.reactions;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationsThunk.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchNotificationsThunk.fulfilled, (state, action) => {
        state.status = 'idle';
        state.notifications = action.payload.data;
        state.unreadCount = action.payload.data.filter((n) => !n.read).length;
        state.hasMore = action.payload.metadata.hasMore;
        state.cursor = action.payload.metadata.cursor;
      })
      .addCase(fetchNotificationsThunk.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(fetchMoreNotificationsThunk.fulfilled, (state, action) => {
        const existingIds = new Set(state.notifications.map((n) => n.id));
        const newOnes = action.payload.data.filter((n) => !existingIds.has(n.id));
        state.notifications.push(...newOnes);
        state.unreadCount = state.notifications.filter((n) => !n.read).length;
        state.hasMore = action.payload.metadata.hasMore;
        state.cursor = action.payload.metadata.cursor;
      })
      .addCase(markReadThunk.fulfilled, (state, action) => {
        const n = state.notifications.find((n) => n.id === action.payload);
        if (n && !n.read) {
          n.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllReadThunk.fulfilled, (state) => {
        for (const n of state.notifications) {
          n.read = true;
        }
        state.unreadCount = 0;
      })
      .addCase(deleteNotificationThunk.fulfilled, (state, action) => {
        const idx = state.notifications.findIndex((n) => n.id === action.payload);
        if (idx !== -1) {
          const item = state.notifications[idx];
          const wasUnread = item ? !item.read : false;
          state.notifications.splice(idx, 1);
          if (wasUnread) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }
      })
      .addCase(clearAllNotificationsThunk.fulfilled, (state) => {
        state.notifications = [];
        state.unreadCount = 0;
        state.hasMore = false;
        state.cursor = null;
      });
  },
});

export const notificationSliceActions = notificationSlice.actions;

// ---------- Selectors ----------

export const selectNotifications = (state: RootState) => state.notifications.notifications;
export const selectUnreadCount = (state: RootState) => state.notifications.unreadCount;
export const selectNotificationStatus = (state: RootState) => state.notifications.status;
export const selectNotificationHasMore = (state: RootState) => state.notifications.hasMore;

export default notificationSlice.reducer;

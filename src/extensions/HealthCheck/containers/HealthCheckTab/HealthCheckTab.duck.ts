// Redux Toolkit slice for the Health Check tab.
// State: list of health check entries, per-entry probing flags, last-refreshed timestamp.

import {
  createSelector,
  createSlice,
  type PayloadAction,
  type SerializedError,
} from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import {
  fetchHealthChecks,
  addHealthCheck,
  removeHealthCheck,
  probeHealthCheck,
  probeAllHealthChecks,
  fetchPresets,
  type HealthCheck,
  type ProbeResult,
  type HealthCheckPreset,
  type HealthCheckType,
} from '../../api';

// ---------- State ----------

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface HealthCheckTabState {
  /** Ordered list of health check entries for the current board. */
  entries: HealthCheck[];
  /** Set of healthCheckIds that are currently being probed on-demand. */
  probingIds: string[];
  /** ISO timestamp of the last successful list fetch. */
  lastCheckedAt: string | null;
  /** Overall fetch/load status. */
  status: RequestStatus;
  error: SerializedError | null;
  /** Available preset services for the Add Service modal. */
  presets: HealthCheckPreset[];
  presetsStatus: RequestStatus;
}

const initialState: HealthCheckTabState = {
  entries: [],
  probingIds: [],
  lastCheckedAt: null,
  status: 'idle',
  error: null,
  presets: [],
  presetsStatus: 'idle',
};

// ---------- Thunks ----------

export const fetchHealthChecksThunk = createAppAsyncThunk(
  'healthCheckTab/fetch',
  async ({ boardId }: { boardId: string }, { extra }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (extra as any).api;
    return fetchHealthChecks({ api, boardId });
  },
);

export const fetchPresetsThunk = createAppAsyncThunk(
  'healthCheckTab/fetchPresets',
  async (_: void, { extra }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (extra as any).api;
    return fetchPresets({ api });
  },
);

export const addHealthCheckThunk = createAppAsyncThunk(
  'healthCheckTab/add',
  async (
    {
      boardId,
      name,
      url,
      type,
      presetKey,
    }: { boardId: string; name: string; url: string; type: HealthCheckType; presetKey?: string },
    { extra },
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (extra as any).api;
    return addHealthCheck({ api, boardId, name, url, type, ...(presetKey !== undefined ? { presetKey } : {}) });
  },
);

export const removeHealthCheckThunk = createAppAsyncThunk(
  'healthCheckTab/remove',
  async (
    { boardId, healthCheckId }: { boardId: string; healthCheckId: string },
    { extra },
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (extra as any).api;
    await removeHealthCheck({ api, boardId, healthCheckId });
    return healthCheckId;
  },
);

export const probeSingleThunk = createAppAsyncThunk(
  'healthCheckTab/probeSingle',
  async (
    { boardId, healthCheckId }: { boardId: string; healthCheckId: string },
    { extra },
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (extra as any).api;
    return probeHealthCheck({ api, boardId, healthCheckId });
  },
);

export const probeAllThunk = createAppAsyncThunk(
  'healthCheckTab/probeAll',
  async ({ boardId }: { boardId: string }, { extra }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (extra as any).api;
    return probeAllHealthChecks({ api, boardId });
  },
);

// ---------- Helpers ----------

/** Merges a single ProbeResult back into the matching entry's latestResult. */
function applyProbeResult(entries: HealthCheck[], result: ProbeResult): HealthCheck[] {
  return entries.map((entry) => {
    if (entry.id !== result.healthCheckId) return entry;
    return {
      ...entry,
      latestResult: {
        status: result.status,
        httpStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.errorMessage,
        checkedAt: result.checkedAt,
      },
    };
  });
}

// ---------- Slice ----------

const healthCheckTabSlice = createSlice({
  name: 'healthCheckTab',
  initialState,
  reducers: {
    /** Allows the auto-refresh hook to clear state when switching boards. */
    resetHealthCheckTab: () => initialState,
  },
  extraReducers: (builder) => {
    // --- fetchHealthChecks ---
    builder.addCase(fetchHealthChecksThunk.pending, (state) => {
      state.status = 'loading';
      state.error = null;
    });
    builder.addCase(
      fetchHealthChecksThunk.fulfilled,
      (state, action: PayloadAction<{ data: HealthCheck[] }>) => {
        state.status = 'succeeded';
        state.entries = action.payload.data;
        state.lastCheckedAt = new Date().toISOString();
      },
    );
    builder.addCase(fetchHealthChecksThunk.rejected, (state, action) => {
      state.status = 'failed';
      state.error = action.error;
    });

    // --- fetchPresets ---
    builder.addCase(fetchPresetsThunk.pending, (state) => {
      state.presetsStatus = 'loading';
    });
    builder.addCase(
      fetchPresetsThunk.fulfilled,
      (state, action: PayloadAction<{ data: HealthCheckPreset[] }>) => {
        state.presetsStatus = 'succeeded';
        state.presets = action.payload.data;
      },
    );
    builder.addCase(fetchPresetsThunk.rejected, (state) => {
      state.presetsStatus = 'failed';
    });

    // --- addHealthCheck ---
    builder.addCase(
      addHealthCheckThunk.fulfilled,
      (state, action: PayloadAction<{ data: HealthCheck }>) => {
        state.entries.push(action.payload.data);
      },
    );

    // --- removeHealthCheck ---
    builder.addCase(
      removeHealthCheckThunk.fulfilled,
      (state, action: PayloadAction<string>) => {
        state.entries = state.entries.filter((e) => e.id !== action.payload);
      },
    );

    // --- probeSingle ---
    builder.addCase(probeSingleThunk.pending, (state, action) => {
      const id = action.meta.arg.healthCheckId;
      if (!state.probingIds.includes(id)) {
        state.probingIds.push(id);
      }
    });
    builder.addCase(
      probeSingleThunk.fulfilled,
      (state, action: PayloadAction<{ data: ProbeResult }>) => {
        const result = action.payload.data;
        state.probingIds = state.probingIds.filter((id) => id !== result.healthCheckId);
        state.entries = applyProbeResult(state.entries, result);
      },
    );
    builder.addCase(probeSingleThunk.rejected, (state, action) => {
      const id = action.meta.arg.healthCheckId;
      state.probingIds = state.probingIds.filter((pid) => pid !== id);
    });

    // --- probeAll ---
    builder.addCase(probeAllThunk.pending, (state) => {
      // Mark every entry as probing.
      state.probingIds = state.entries.map((e) => e.id);
    });
    builder.addCase(
      probeAllThunk.fulfilled,
      (state, action: PayloadAction<{ data: ProbeResult[] }>) => {
        let updated = state.entries;
        for (const result of action.payload.data) {
          updated = applyProbeResult(updated, result);
        }
        state.entries = updated;
        state.probingIds = [];
        state.lastCheckedAt = new Date().toISOString();
      },
    );
    builder.addCase(probeAllThunk.rejected, (state) => {
      state.probingIds = [];
    });
  },
});

export const { resetHealthCheckTab } = healthCheckTabSlice.actions;
export default healthCheckTabSlice.reducer;

// ---------- Selectors ----------

const selectHealthCheckTab = (state: RootState) =>
  (state as unknown as { healthCheckTab: HealthCheckTabState }).healthCheckTab;

export const selectHealthCheckEntries = createSelector(
  selectHealthCheckTab,
  (s) => s.entries,
);

export const selectHealthCheckStatus = createSelector(
  selectHealthCheckTab,
  (s) => s.status,
);

export const selectHealthCheckError = createSelector(
  selectHealthCheckTab,
  (s) => s.error,
);

export const selectHealthCheckLastCheckedAt = createSelector(
  selectHealthCheckTab,
  (s) => s.lastCheckedAt,
);

export const selectProbingIds = createSelector(
  selectHealthCheckTab,
  (s) => s.probingIds,
);

export const selectHealthCheckPresets = createSelector(
  selectHealthCheckTab,
  (s) => s.presets,
);

export const selectHealthCheckPresetsStatus = createSelector(
  selectHealthCheckTab,
  (s) => s.presetsStatus,
);

/** Returns true if a specific health check is currently being probed. */
export const selectIsProbing = (healthCheckId: string) =>
  createSelector(selectProbingIds, (ids) => ids.includes(healthCheckId));

// src/extensions/Search/slices/searchSlice.ts
// Client-side cache for workspace search results.
// Exposes purgeInaccessibleResult so stale board entries can be removed
// immediately after a 403/404 access failure, keeping the cached result set
// consistent with the server's actual permission state.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SearchResult } from '../api';

interface SearchCacheState {
  /** Most recently fetched search results — keyed by result id for fast purge */
  results: SearchResult[];
  /** Query string that produced the current cached results */
  query: string;
}

const initialState: SearchCacheState = {
  results: [],
  query: '',
};

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    /** Replace the entire cache after a successful search response */
    setSearchResults(
      state,
      action: PayloadAction<{ results: SearchResult[]; query: string }>,
    ) {
      state.results = action.payload.results;
      state.query = action.payload.query;
    },

    /**
     * Remove a single result from the cache by its id.
     * Called after a board result click fails with 403/404, signalling
     * that the cached entry is stale and the board is now inaccessible.
     */
    purgeInaccessibleResult(state, action: PayloadAction<{ id: string }>) {
      state.results = state.results.filter((r) => r.id !== action.payload.id);
    },

    /** Clear the entire cache (e.g. on workspace switch or logout) */
    clearSearchCache(state) {
      state.results = [];
      state.query = '';
    },
  },
});

export const { setSearchResults, purgeInaccessibleResult, clearSearchCache } =
  searchSlice.actions;

export default searchSlice.reducer;

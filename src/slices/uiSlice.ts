import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface UiState {
  theme: 'light' | 'dark' | 'elegant' | 'elegant-dark' | 'paper' | 'nordic' | 'archive' | 'macintosh' | 'obsidian' | 'next' | 'bauhaus' | 'moss' | 'vapor' | 'cyberpunk' | 'the-seven' | 'hc-light' | 'hc-dark';
  sidebarOpen: boolean;
  activeModal: string | null;
}

const initialState: UiState = {
  theme: 'dark',
  sidebarOpen: true,
  activeModal: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<'light' | 'dark' | 'elegant' | 'elegant-dark' | 'paper' | 'nordic' | 'archive' | 'macintosh' | 'obsidian' | 'next' | 'bauhaus' | 'moss' | 'vapor' | 'cyberpunk' | 'the-seven' | 'hc-light' | 'hc-dark'>) {
      state.theme = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    openModal(state, action: PayloadAction<string>) {
      state.activeModal = action.payload;
    },
    closeModal(state) {
      state.activeModal = null;
    },
  },
});

export const { setTheme, toggleSidebar, openModal, closeModal } =
  uiSlice.actions;
export const uiReducer = uiSlice.reducer;

export const selectTheme = (state: RootState) => state.ui.theme;
export const selectSidebarOpen = (state: RootState) => state.ui.sidebarOpen;
export const selectActiveModal = (state: RootState) => state.ui.activeModal;

// Redux slice for the AdminInvite feature — tracks modal open/close and
// stores credentials returned after a successful account creation.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import type { AdminInviteState, AdminCreateUserResponse } from './types';

const initialState: AdminInviteState = {
  isOpen: false,
  credentials: null,
  emailSent: false,
};

const adminInviteSlice = createSlice({
  name: 'adminInvite',
  initialState,
  reducers: {
    openInviteModal(state) {
      state.isOpen = true;
      // Reset credential state each time the modal is opened fresh
      state.credentials = null;
      state.emailSent = false;
    },
    closeInviteModal(state) {
      state.isOpen = false;
      state.credentials = null;
      state.emailSent = false;
    },
    setInviteCredentials(
      state,
      action: PayloadAction<Pick<AdminCreateUserResponse, 'credentials' | 'emailSent'>>,
    ) {
      state.credentials = action.payload.credentials;
      state.emailSent = action.payload.emailSent;
    },
  },
});

export const { openInviteModal, closeInviteModal, setInviteCredentials } =
  adminInviteSlice.actions;

export const adminInviteReducer = adminInviteSlice.reducer;

export const selectInviteModalOpen = (state: RootState) => state.adminInvite.isOpen;
export const selectInviteCredentials = (state: RootState) => state.adminInvite.credentials;
export const selectInviteEmailSent = (state: RootState) => state.adminInvite.emailSent;

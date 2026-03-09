// Types for the AdminInvite feature — admin-created external user accounts.

export interface AdminCreateUserRequest {
  email: string;
  displayName: string;
  password?: string;
  sendEmail?: boolean;
}

export interface AdminCreateUserResponse {
  data: {
    id: string;
    email: string;
    displayName: string;
  };
  credentials: {
    email: string;
    plainPassword: string;
  };
  emailSent: boolean;
}

export type PasswordMode = 'auto' | 'manual';

export interface AdminInviteState {
  isOpen: boolean;
  // Set after a successful account creation
  credentials: AdminCreateUserResponse['credentials'] | null;
  emailSent: boolean;
}

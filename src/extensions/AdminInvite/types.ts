// Types for the AdminInvite feature — admin-created external user accounts.

export interface AdminCreateUserRequest {
  email: string;
  displayName: string;
  password?: string;
  sendEmail?: boolean;
  autoVerifyEmail?: boolean;
}

export interface AdminCreateUserResponse {
  data: {
    id: string;
    email: string;
    displayName: string;
    email_verified_at: string | null;
  };
  credentials: {
    email: string;
    plainPassword: string;
  };
  emailSent: boolean;
  emailVerifiedAt: string | null;
}

export type PasswordMode = 'auto' | 'manual';

export interface AdminInviteState {
  isOpen: boolean;
  // Set after a successful account creation
  credentials: AdminCreateUserResponse['credentials'] | null;
  emailSent: boolean;
  emailVerifiedAt: string | null;
}

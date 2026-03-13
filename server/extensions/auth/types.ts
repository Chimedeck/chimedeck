// server/extensions/auth/types.ts
// Shared TypeScript types for the auth extension.

export interface AdminCreateUserBody {
  email: string;
  displayName: string;
  password?: string;
  sendEmail?: boolean;
  /** When true, sets email_verified_at = NOW() at insert time and skips the verification flow. Default: false */
  autoVerifyEmail?: boolean;
}

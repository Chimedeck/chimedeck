// Platform admin email list — controls who can mutate the plugin registry.
// Read from PLATFORM_ADMIN_EMAILS (comma-separated). Fail safe: empty list = deny all.
import { env } from './env';

export const platformAdminEmails: readonly string[] = env.PLATFORM_ADMIN_EMAILS
  ? env.PLATFORM_ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

export function isPlatformAdmin(email: string): boolean {
  return platformAdminEmails.includes(email.toLowerCase());
}

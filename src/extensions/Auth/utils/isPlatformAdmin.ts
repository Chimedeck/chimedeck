// Checks whether the given user email is in the VITE_PLATFORM_ADMIN_EMAILS list.
// Env var is a comma-separated list of admin emails (e.g. "a@x.com,b@x.com").
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw: string = (import.meta.env.VITE_PLATFORM_ADMIN_EMAILS as string) ?? '';
  const adminEmails = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

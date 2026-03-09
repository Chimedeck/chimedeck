import { env } from '../../../config/env';

// Returns true when the email's domain is in ADMIN_EMAIL_DOMAINS.
// Completely independent of ALLOWED_EMAIL_DOMAINS / isEmailDomainAllowed().
export const isAdminEmailDomain = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const adminDomains = env.ADMIN_EMAIL_DOMAINS
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return adminDomains.includes(domain);
};

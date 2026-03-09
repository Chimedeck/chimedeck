import { env } from '../../../config/env';

// Returns the domain part of an email address, lower-cased.
export const extractDomain = (email: string): string =>
  email.split('@')[1]?.toLowerCase() ?? '';

// Returns true when the email domain is in the configured allowlist,
// OR when domain restriction is disabled entirely.
export const isEmailDomainAllowed = (email: string): boolean => {
  if (!env.EMAIL_DOMAIN_RESTRICTION_ENABLED) return true;
  const allowed = env.ALLOWED_EMAIL_DOMAINS
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(extractDomain(email));
};

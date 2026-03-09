import { randomBytes } from 'crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Generates a cryptographically random URL-safe password of the given length.
// Default length: 16. Character set: a-z A-Z 0-9.
export const generatePassword = (length = 16): string => {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join('');
};

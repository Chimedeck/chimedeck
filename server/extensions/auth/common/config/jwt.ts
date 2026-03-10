// JWT RS256 key configuration.
// Keys are loaded once at startup from Bun.env via env.ts.
import { env } from '../../../../config/env';

export const jwtConfig = {
  // PEM-encoded RS256 private key (PKCS8 format)
  privateKey: env.JWT_PRIVATE_KEY,
  // PEM-encoded RS256 public key (SPKI format)
  publicKey: env.JWT_PUBLIC_KEY,
  accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS, // default 24h, overridable via env var
  refreshTokenTtlDays: 7,
} as const;

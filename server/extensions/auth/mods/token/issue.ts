// Issues RS256 JWT access tokens (15-minute TTL).
import { SignJWT, importPKCS8 } from 'jose';
import { jwtConfig } from '../../common/config/jwt';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

// [why] importPKCS8 reads the PEM block and re-decodes the inner base64 DER
// payload. If env.JWT_PRIVATE_KEY is malformed (truncated, has stray bytes,
// the env var was truncated when the .env was committed, etc.) Bun's
// `Uint8Array.fromBase64` throws deep inside the jose call stack. We catch
// and re-throw with a clear, actionable message so the caller (login handler)
// can surface a 500 that names the env var to fix, instead of leaking the
// raw "fromBase64 requires a valid base64 string" stack trace to the client.
export class AccessTokenKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessTokenKeyError';
  }
}

// Returns a signed JWT access token.
export async function issueAccessToken({ sub, email }: AccessTokenPayload): Promise<string> {
  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(jwtConfig.privateKey, 'RS256');
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new AccessTokenKeyError(
      `Failed to load JWT_PRIVATE_KEY. The env var is set but the PEM block ` +
        `is malformed (${reason}). Re-run the openssl keygen step from the ` +
        `README and re-paste the base64-encoded value into .env.`,
    );
  }

  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${jwtConfig.accessTokenTtlSeconds}s`)
    .sign(privateKey);
}

// Issues short-lived RS256 JWT tokens for Trello-compatible API access.
// These tokens grant access to /trello/1/* endpoints and have a configurable TTL.
import { SignJWT, importPKCS8 } from 'jose';
import { jwtConfig } from '../../common/config/jwt';

export interface TrelloCompatTokenPayload {
  sub: string;
  email: string;
  scope?: string;
}

// Issues a short-lived JWT for Trello-compatible API access (default 1 hour).
export async function issueTrelloCompatToken(
  { sub, email, scope = 'read' }: TrelloCompatTokenPayload,
  ttlSeconds: number = 3600
): Promise<string> {
  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(jwtConfig.privateKey, 'RS256');
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Failed to issue Trello token: JWT_PRIVATE_KEY is malformed (${reason})`);
  }

  return new SignJWT({ email, scope })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(privateKey);
}

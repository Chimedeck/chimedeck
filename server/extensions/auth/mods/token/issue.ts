// Issues RS256 JWT access tokens (15-minute TTL).
import { SignJWT, importPKCS8 } from 'jose';
import { jwtConfig } from '../../common/config/jwt';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

// Returns a signed JWT access token.
export async function issueAccessToken({ sub, email }: AccessTokenPayload): Promise<string> {
  const privateKey = await importPKCS8(jwtConfig.privateKey, 'RS256');

  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${jwtConfig.accessTokenTtlSeconds}s`)
    .sign(privateKey);
}

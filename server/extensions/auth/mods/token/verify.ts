// Verifies and decodes RS256 JWT access tokens.
import { jwtVerify, importSPKI } from 'jose';
import { jwtConfig } from '../../common/config/jwt';

export interface DecodedToken {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

// Returns decoded payload or null if the token is invalid/expired.
export async function verifyAccessToken({ token }: { token: string }): Promise<DecodedToken | null> {
  try {
    const publicKey = await importSPKI(jwtConfig.publicKey, 'RS256');
    const { payload } = await jwtVerify(token, publicKey, { algorithms: ['RS256'] });

    return {
      sub: payload.sub as string,
      email: payload['email'] as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

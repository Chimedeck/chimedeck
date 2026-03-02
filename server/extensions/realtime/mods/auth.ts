// server/extensions/realtime/mods/auth.ts
// Verifies the Bearer token for WebSocket connections.
import { verifyAccessToken } from '../../auth/mods/token/verify';

export interface WsAuthResult {
  userId: string;
  token: string;
}

export async function verifyWsToken(token: string): Promise<WsAuthResult | null> {
  const decoded = await verifyAccessToken({ token });
  if (!decoded) return null;
  return { userId: decoded.sub, token };
}

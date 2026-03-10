// Verifies a plugin-scoped HS256 JWT issued by the /token endpoint.
// The HMAC secret is the plugin's api_key fetched from DB — it never leaves the server.
// Returns the resolved plugin row on success, or an error Response.
import { jwtVerify } from 'jose';
import { db } from '../../../common/db';

export interface PluginTokenClaims {
  sub: string;     // userId
  pluginId: string;
  boardId: string;
}

export async function resolvePluginToken(
  req: Request,
): Promise<{ plugin: Record<string, unknown>; claims: PluginTokenClaims } | Response> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Authorization: Bearer <plugin-token> header required' } },
      { status: 401 },
    );
  }
  const token = (match[1] ?? '').trim();

  // Decode without verification first to extract pluginId and look up the signing secret.
  let rawClaims: Record<string, unknown>;
  try {
    // jose's decodeJwt is a lightweight decode — we'll fully verify below.
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('malformed');
    rawClaims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8'));
  } catch {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Malformed plugin token' } },
      { status: 401 },
    );
  }

  const pluginId = rawClaims['pluginId'];
  if (!pluginId || typeof pluginId !== 'string') {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Plugin token missing pluginId claim' } },
      { status: 401 },
    );
  }

  const plugin = await db('plugins').where({ id: pluginId, is_active: true }).first();
  if (!plugin?.api_key) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Invalid or inactive plugin' } },
      { status: 401 },
    );
  }

  // Fully verify the token with the plugin's api_key as the HMAC secret.
  try {
    const secret = new TextEncoder().encode(plugin.api_key as string);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });

    const claims: PluginTokenClaims = {
      sub: payload.sub as string,
      pluginId: payload['pluginId'] as string,
      boardId: payload['boardId'] as string,
    };

    return { plugin, claims };
  } catch {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Invalid or expired plugin token' } },
      { status: 401 },
    );
  }
}

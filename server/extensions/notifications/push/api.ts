import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { ownsDevice, parseDevice, secretHash } from './contracts';
import { pushEnabled } from './firebase';

function errorResponse({
  status,
  name,
  message,
}: {
  status: number;
  name: string;
  message: string;
}): Response {
  return Response.json({ name, data: { message } }, { status });
}

export async function pushRouter({
  req,
  pathname,
}: {
  req: Request;
  pathname: string;
}): Promise<Response | null> {
  const revoke = pathname.match(
    /^\/api\/v1\/notifications\/devices\/([a-zA-Z0-9-]{16,64})\/revoke$/
  );
  // A per-installation proof also permits revocation after the user's session expires.
  if (revoke && req.method === 'POST') {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return errorResponse({
        status: 400,
        name: 'invalid-json',
        message: 'Expected a JSON object.',
      });
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return errorResponse({
        status: 400,
        name: 'invalid-device',
        message: 'Expected a JSON object.',
      });
    }
    const body = raw as Record<string, unknown>;
    await db.transaction(async (trx) => {
      // Share the registration lock so a late logout cannot race a reassignment.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [revoke[1]]);
      const row = await trx('notification_devices').where({ id: revoke[1] }).first();
      if (
        row &&
        body.user_id === row.user_id &&
        ownsDevice({ secret: body.secret, hash: row.secret_hash })
      ) {
        await trx('notification_devices')
          .where({ id: row.id, user_id: body.user_id, secret_hash: row.secret_hash })
          .update({ enabled: false });
      }
    });
    return new Response(null, { status: 204 });
  }
  if (
    ![
      '/api/v1/notifications/devices',
      '/api/v1/notifications/push-capabilities',
      '/api/v1/notifications/unread-count',
    ].includes(pathname)
  )
    return null;
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;
  const userId = (req as AuthenticatedRequest).currentUser!.id;
  if (pathname.endsWith('/unread-count') && req.method === 'GET') {
    const row = await db('notifications')
      .where({ user_id: userId, read: false })
      .whereNot('type', 'card_updated')
      .count('* as count')
      .first();
    return Response.json({ data: { count: Number(row?.count ?? 0) } });
  }
  if (pathname.endsWith('/push-capabilities') && req.method === 'GET') {
    return Response.json({
      data: {
        development: pushEnabled({ environment: 'development' }),
        production: pushEnabled({ environment: 'production' }),
      },
    });
  }
  if (pathname.endsWith('/devices') && req.method === 'PUT') {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return errorResponse({
        status: 400,
        name: 'invalid-json',
        message: 'Expected a JSON object.',
      });
    }
    const input = parseDevice({ body: raw });
    if (!input)
      return errorResponse({
        status: 400,
        name: 'invalid-device',
        message: 'Invalid device registration.',
      });
    if (!pushEnabled({ environment: input.environment }))
      return errorResponse({
        status: 503,
        name: 'push-unavailable',
        message: 'Push delivery is not configured for this environment.',
      });
    const result = await db.transaction(async (trx) => {
      // Serialize creation/rotation for an installation, including the first insert.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [input.id]);
      const existing = await trx('notification_devices').where({ id: input.id }).first();
      if (existing && !ownsDevice({ secret: input.secret, hash: existing.secret_hash }))
        return false;
      // FCM may reissue the same token after reinstall. Disable its earlier mapping
      // without transferring the old installation's revocation proof.
      await trx('notification_devices')
        .where({ environment: input.environment, token: input.token })
        .whereNot('id', input.id)
        .delete();
      await trx('notification_devices')
        .insert({
          id: input.id,
          secret_hash: secretHash({ secret: input.secret }),
          user_id: userId,
          platform: input.platform,
          environment: input.environment,
          token: input.token,
          enabled: true,
          updated_at: new Date(),
        })
        .onConflict('id')
        .merge();
      return true;
    });
    return result
      ? Response.json({ data: { registered: true } })
      : errorResponse({
          status: 409,
          name: 'device-conflict',
          message: 'Device registration could not be verified.',
        });
  }
  return errorResponse({
    status: 405,
    name: 'method-not-allowed',
    message: 'This method is not supported for this resource.',
  });
}

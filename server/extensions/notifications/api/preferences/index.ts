// Router for /api/v1/notifications/preferences endpoints.
import { flags } from '../../../../mods/flags';
import { handleGetPreferences } from './get';
import { handleUpdatePreferences } from './update';

export async function preferencesRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  if (pathname !== '/api/v1/notifications/preferences') return null;

  const enabled = await flags.isEnabled('NOTIFICATION_PREFERENCES_ENABLED');
  if (!enabled) {
    return Response.json(
      { error: { name: 'feature-disabled', data: { message: 'Notification preferences are disabled' } } },
      { status: 501 },
    );
  }

  if (req.method === 'GET') return handleGetPreferences(req);
  if (req.method === 'PATCH') return handleUpdatePreferences(req);

  return null;
}

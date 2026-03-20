// Router for GET and PATCH /api/v1/user/notification-settings
import { handleGetGlobalNotificationSetting } from './get';
import { handleUpdateGlobalNotificationSetting } from './update';

export async function globalPreferenceRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  if (pathname !== '/api/v1/user/notification-settings') return null;

  if (req.method === 'GET') return handleGetGlobalNotificationSetting(req);
  if (req.method === 'PATCH') return handleUpdateGlobalNotificationSetting(req);

  return null;
}

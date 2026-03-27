// Health Check extension entry point.
// All routes return 404 when HEALTH_CHECK_ENABLED is false (deny-first).
import { healthCheckConfig } from './common/config/healthCheck';
import { healthCheckRouter } from './api/index';

const featureDisabled = () =>
  Response.json(
    { error: { name: 'not-found', data: { message: 'Not found' } } },
    { status: 404 },
  );

export async function healthCheckExtensionRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  // Short-circuit when the feature flag is off — expose no surface area.
  if (!healthCheckConfig.enabled) {
    const isHealthCheckPath =
      pathname === '/api/v1/health-check/presets' ||
      /^\/api\/v1\/boards\/[^/]+\/health-checks/.test(pathname);
    if (isHealthCheckPath) return featureDisabled();
    return null;
  }

  return healthCheckRouter(req, pathname);
}

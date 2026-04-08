// Centralised config for the Health Check probe engine.
// All env var access is delegated to the top-level env module — never use Bun.env directly here.
import { env } from '../../../../config/env';

export const healthCheckConfig = {
  /** Feature flag — all /health-checks routes return 404 when false. */
  enabled: env.HEALTH_CHECK_ENABLED,
  /** HTTP probe timeout in milliseconds. Default: 10 000. */
  timeoutMs: env.HEALTH_CHECK_TIMEOUT_MS,
  /** Response time threshold above which a 2xx response is classified amber. Default: 1 000. */
  amberThresholdMs: env.HEALTH_CHECK_AMBER_THRESHOLD_MS,
} as const;

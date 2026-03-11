// Automation feature flag and config.
// All automation env vars are centralised here — never read Bun.env directly outside this file.

export const automationConfig = {
  /** Gate for all automation routes and the evaluation hook. */
  enabled: Bun.env['AUTOMATION_ENABLED'] !== 'false',
  /** Maximum parallel automation evaluations per evaluate() call. */
  maxConcurrent: 5,
  /** Maximum run log rows retained per automation before oldest are purged. */
  runLogCap: 1000,
} as const;

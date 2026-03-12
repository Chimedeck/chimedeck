// Automation feature flag and config.
// All automation env vars are centralised here — never read Bun.env directly outside this file.

export const automationConfig = {
  /** Gate for all automation routes and the evaluation hook. */
  enabled: Bun.env['AUTOMATION_ENABLED'] !== 'false',
  /** Maximum parallel automation evaluations per evaluate() call. */
  maxConcurrent: 5,
  /** Maximum run log rows retained per automation before oldest are purged. */
  runLogCap: 1000,
  /**
   * When true, pg_cron fires automation_scheduler_tick() every minute via pg_notify.
   * When false (local dev default), the Bun Worker fallback uses setInterval instead.
   * Requires pg_cron installed and configured on the DB host — see sprint-64.md §2.
   */
  usePgCron: Bun.env['AUTOMATION_USE_PGCRON'] === 'true',
  /**
   * Gate for the scheduler (LISTEN client + Worker fallback).
   * Set to false to disable all time-based automation scheduling without disabling
   * the rest of the automation system.
   */
  schedulerEnabled: Bun.env['AUTOMATION_SCHEDULER_ENABLED'] !== 'false',
} as const;

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
   * Requires pg_cron installed and configured on the DB host — see sprint-64.md §2.
   * When false, time-based scheduling is fully disabled (Bun Worker fallback caused
   * memory leaks and has been removed).
   */
  usePgCron: Bun.env['AUTOMATION_USE_PGCRON'] === 'true',
  /**
   * Scheduling is only active when pg_cron is available (AUTOMATION_USE_PGCRON=true).
   * The Bun Worker fallback has been removed due to memory leaks — there is no
   * in-process scheduler fallback.
   */
  schedulerEnabled: Bun.env['AUTOMATION_USE_PGCRON'] === 'true',
  /**
   * Maximum automation runs allowed per board per calendar month.
   * Defaults to 1000. Override with AUTOMATION_MONTHLY_QUOTA env var.
   * Invalid or missing values fall back to the default.
   */
  monthlyQuota: (() => {
    const raw = Bun.env['AUTOMATION_MONTHLY_QUOTA'];
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
  })(),
} as const;

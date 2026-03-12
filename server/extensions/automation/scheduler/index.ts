// Automation scheduler entry point.
// Starts either the pg LISTEN client (pg_cron path) or the Bun Worker fallback
// depending on the AUTOMATION_USE_PGCRON config flag.
//
// Called once at server startup from server/index.ts.

import { automationConfig } from '../config';
import { startAutomationListener } from './listener';

export async function startAutomationScheduler(): Promise<void> {
  if (!automationConfig.schedulerEnabled) {
    console.info('[automation-scheduler] disabled via AUTOMATION_SCHEDULER_ENABLED=false');
    return;
  }

  if (automationConfig.usePgCron) {
    // Production path: pg_cron fires pg_notify; we LISTEN for ticks.
    await startAutomationListener();
  } else {
    // Local dev fallback: no pg_cron — use a Bun Worker thread with setInterval.
    // The worker is spawned in an isolated thread so it doesn't block HTTP handling.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (Worker as any)(new URL('./workerFallback.ts', import.meta.url));
    console.info('[automation-scheduler] Bun Worker fallback started (AUTOMATION_USE_PGCRON=false)');
  }
}

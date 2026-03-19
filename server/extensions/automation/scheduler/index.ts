// Automation scheduler entry point.
// Starts the pg LISTEN client when AUTOMATION_USE_PGCRON=true.
// When pg_cron is not available scheduling is fully disabled — the Bun Worker
// fallback has been removed because it caused memory leaks.
//
// Called once at server startup from server/index.ts.

import { automationConfig } from '../config';
import { startAutomationListener } from './listener';

export async function startAutomationScheduler(): Promise<void> {
  if (!automationConfig.schedulerEnabled) {
    // schedulerEnabled is only true when AUTOMATION_USE_PGCRON=true, so this
    // branch covers both "flag explicitly off" and "pg_cron not configured".
    console.info('[automation-scheduler] disabled — set AUTOMATION_USE_PGCRON=true to enable pg_cron scheduling');
    return;
  }

  // pg_cron fires pg_notify every minute; we LISTEN for those ticks.
  await startAutomationListener();
}

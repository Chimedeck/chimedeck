// Bun Worker fallback for local dev environments without pg_cron.
// Runs in an isolated Bun Worker thread so the setInterval does not compete
// with the main HTTP thread.
//
// Calls automation_scheduler_tick() directly every 60 s via the shared DB pool.
// Multi-replica double-fire is acceptable in single-node local dev — the tick
// function uses last_run_at to guard against duplicate SCHEDULED fires anyway.

import { db } from '../../../common/db';

setInterval(async () => {
  try {
    await db.raw('SELECT automation_scheduler_tick()');
  } catch (err) {
    console.error('[automation-worker-fallback] tick error', err);
  }
}, 60_000);

console.info('[automation-worker-fallback] started, tick every 60 s');

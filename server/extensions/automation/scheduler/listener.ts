// Bun LISTEN client for the automation_tick pg_notify channel.
// Used in production (AUTOMATION_USE_PGCRON=true) where pg_cron fires
// automation_scheduler_tick() every minute, which calls pg_notify for each
// eligible automation.
//
// One dedicated pg.Client is reserved exclusively for LISTEN — it must never
// be shared with regular query traffic because pg can only run one query at
// a time per client and a LISTEN client blocks during notification delivery.

import pg from 'pg';
import { env } from '../../../config/env';
import { execute } from '../engine/index';

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function connect(): Promise<void> {
  const client = new pg.Client({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query('LISTEN automation_tick');

    console.info('[automation-listener] connected, listening on automation_tick');

    client.on('notification', async (msg) => {
      if (msg.channel !== 'automation_tick') return;
      try {
        const { type, automationId, boardId, cardId } = JSON.parse(msg.payload ?? '{}');
        if (!automationId || !boardId || !type) return;
        await execute({ automationId, boardId, cardId: cardId ?? null, actorId: null });
      } catch (err) {
        console.error('[automation-listener] notification parse/execute error', err);
      }
    });

    client.on('error', async (err) => {
      console.error('[automation-listener] client error, scheduling reconnect', err);
      await client.end().catch(() => {});
      scheduleReconnect();
    });
  } catch (err) {
    console.error('[automation-listener] connect failed, scheduling reconnect', err);
    await client.end().catch(() => {});
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch(() => scheduleReconnect());
  }, 5_000);
}

export async function startAutomationListener(): Promise<void> {
  await connect();
}

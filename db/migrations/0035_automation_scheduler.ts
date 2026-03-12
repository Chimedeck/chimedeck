// Sprint 64 — Automation scheduler stored functions.
// Creates three SQL functions used by the scheduler tick (called by pg_cron in production
// or by the Bun Worker fallback in local dev).
// NOTE: CREATE EXTENSION pg_cron and cron.schedule() are intentionally excluded — they
// require superuser privileges and are performed by the DBA as a pre-deploy ops step.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Checks whether a SCHEDULED automation should fire at the current UTC minute.
  // Reads automation_type and config from the automations table, then compares
  // against the current UTC time fields (day-of-week, hour, minute, day-of-month, month).
  await knex.raw(`
    CREATE OR REPLACE FUNCTION automation_should_run_now(p_automation_id uuid)
    RETURNS boolean
    LANGUAGE plpgsql
    STABLE
    AS $$
    DECLARE
      v_config      jsonb;
      v_schedule    text;
      v_now_dow     int;   -- 0=Sunday … 6=Saturday
      v_now_hour    int;
      v_now_minute  int;
      v_now_dom     int;   -- day of month
      v_now_month   int;
    BEGIN
      SELECT config
        INTO v_config
        FROM automations
       WHERE id = p_automation_id
         AND automation_type = 'SCHEDULED';

      IF NOT FOUND THEN
        RETURN FALSE;
      END IF;

      v_schedule   := v_config->>'scheduleType';
      v_now_dow    := EXTRACT(DOW   FROM NOW() AT TIME ZONE 'UTC')::int;
      v_now_hour   := EXTRACT(HOUR  FROM NOW() AT TIME ZONE 'UTC')::int;
      v_now_minute := EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'UTC')::int;
      v_now_dom    := EXTRACT(DAY   FROM NOW() AT TIME ZONE 'UTC')::int;
      v_now_month  := EXTRACT(MONTH FROM NOW() AT TIME ZONE 'UTC')::int;

      RETURN CASE v_schedule
        WHEN 'daily' THEN
          v_now_hour   = (v_config->>'hour')::int
          AND v_now_minute = (v_config->>'minute')::int

        WHEN 'weekly' THEN
          v_now_dow    = (v_config->>'dayOfWeek')::int
          AND v_now_hour   = (v_config->>'hour')::int
          AND v_now_minute = (v_config->>'minute')::int

        WHEN 'monthly' THEN
          v_now_dom    = (v_config->>'dayOfMonth')::int
          AND v_now_hour   = (v_config->>'hour')::int
          AND v_now_minute = (v_config->>'minute')::int

        WHEN 'yearly' THEN
          v_now_month  = (v_config->>'month')::int
          AND v_now_dom    = (v_config->>'dayOfMonth')::int
          AND v_now_hour   = (v_config->>'hour')::int
          AND v_now_minute = (v_config->>'minute')::int

        ELSE FALSE
      END;
    END;
    $$;
  `);

  // Checks whether NOW() falls within the offsetDays window relative to a card's due_date.
  // trigger_config shape: { "offsetDays": -2, "offsetUnit": "days", "triggerMoment": "before" }
  // triggerMoment "before" → target = due_date + offsetDays (offsetDays is negative for before)
  // triggerMoment "after"  → target = due_date + offsetDays (offsetDays is positive for after)
  // triggerMoment "on"     → offsetDays is 0; window is the current UTC day
  // Fires when the current UTC minute is exactly on the computed target minute (±30s tolerance).
  await knex.raw(`
    CREATE OR REPLACE FUNCTION automation_due_date_in_window(
      p_due_date     timestamptz,
      p_trigger_config jsonb
    )
    RETURNS boolean
    LANGUAGE plpgsql
    STABLE
    AS $$
    DECLARE
      v_offset_days    int;
      v_trigger_moment text;
      v_target         timestamptz;
      v_window_start   timestamptz;
      v_window_end     timestamptz;
    BEGIN
      IF p_due_date IS NULL OR p_trigger_config IS NULL THEN
        RETURN FALSE;
      END IF;

      v_offset_days    := COALESCE((p_trigger_config->>'offsetDays')::int, 0);
      v_trigger_moment := COALESCE(p_trigger_config->>'triggerMoment', 'before');

      -- Compute the target timestamp: shift due_date by the configured offset.
      -- For 'before', offsetDays is expected to be negative (e.g. -1 = 1 day before).
      -- For 'after', offsetDays is positive (e.g. 2 = 2 days after).
      -- For 'on', offsetDays = 0.
      v_target := p_due_date + (v_offset_days || ' days')::interval;

      -- The tick fires every minute; accept a ±30-second window around the target minute.
      v_window_start := date_trunc('minute', v_target) - INTERVAL '30 seconds';
      v_window_end   := date_trunc('minute', v_target) + INTERVAL '90 seconds';

      RETURN NOW() BETWEEN v_window_start AND v_window_end;
    END;
    $$;
  `);

  // Master tick procedure called every minute by pg_cron (or the Bun Worker fallback).
  // Issues pg_notify for each eligible SCHEDULED or DUE_DATE automation so the Bun
  // LISTEN client can pick up the payload and call the automation engine.
  await knex.raw(`
    CREATE OR REPLACE FUNCTION automation_scheduler_tick() RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE rec RECORD;
    BEGIN
      -- SCHEDULED automations: fire when current UTC minute matches config, and the
      -- automation has not already been triggered in the past 58 seconds (prevents
      -- double-fire if pg_cron fires slightly early on the same minute).
      FOR rec IN
        SELECT id, board_id FROM automations
        WHERE automation_type = 'SCHEDULED' AND is_enabled = TRUE
          AND (
            last_run_at IS NULL
            OR last_run_at < date_trunc('minute', NOW() AT TIME ZONE 'UTC') - INTERVAL '58 seconds'
          )
      LOOP
        IF automation_should_run_now(rec.id) THEN
          PERFORM pg_notify(
            'automation_tick',
            json_build_object(
              'type',         'SCHEDULED',
              'automationId', rec.id,
              'boardId',      rec.board_id
            )::text
          );
          -- Update last_run_at inside the same transaction to prevent double-fires
          -- across replicas (advisory lock not needed because pg_cron runs on the
          -- primary only; the Bun Worker fallback is single-node by design).
          UPDATE automations SET last_run_at = NOW() WHERE id = rec.id;
        END IF;
      END LOOP;

      -- DUE_DATE automations: fire for each card whose due_date falls within the
      -- configured offset window, skipping cards already logged in the last 10 minutes
      -- to prevent repeated firings within the same tick window.
      FOR rec IN
        SELECT
          a.id         AS automation_id,
          a.board_id,
          c.id         AS card_id
        FROM   automations a
        JOIN   automation_triggers t ON t.automation_id = a.id
        JOIN   cards c ON c.board_id = a.board_id
        WHERE  a.automation_type = 'DUE_DATE'
          AND  a.is_enabled = TRUE
          AND  c.due_date IS NOT NULL
          AND  automation_due_date_in_window(c.due_date, t.config)
          AND  NOT EXISTS (
                 SELECT 1 FROM automation_run_log l
                 WHERE  l.automation_id = a.id
                   AND  l.card_id = c.id
                   AND  l.ran_at >= NOW() - INTERVAL '10 minutes'
               )
      LOOP
        PERFORM pg_notify(
          'automation_tick',
          json_build_object(
            'type',         'DUE_DATE',
            'automationId', rec.automation_id,
            'boardId',      rec.board_id,
            'cardId',       rec.card_id
          )::text
        );
      END LOOP;
    END;
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP FUNCTION IF EXISTS automation_scheduler_tick()');
  await knex.raw('DROP FUNCTION IF EXISTS automation_due_date_in_window(timestamptz, jsonb)');
  await knex.raw('DROP FUNCTION IF EXISTS automation_should_run_now(uuid)');
}

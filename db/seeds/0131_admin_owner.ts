#!/usr/bin/env bun
/**
 * db/seeds/0131_admin_owner.ts
 *
 * Promotes the ADMIN_OWNER user to platform admin.
 *
 * Usage:
 *   ADMIN_OWNER=admin@journeyh.io bun run db:migrate:admin
 *
 * Environment:
 *   ADMIN_OWNER — email of the user to promote (required)
 *   DATABASE_URL — PostgreSQL connection string (falls back to dev default)
 *
 * Idempotent: safe to re-run — if the user is already an admin, this is a no-op.
 * If the user does not exist, a warning is logged and the script exits 0.
 *
 * Prerequisites: migration 0131_admin_account must have been applied first.
 */

import Knex from 'knex';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dir, '../..'); // repo root

// Load .env so DATABASE_URL and ADMIN_OWNER are available when running standalone
const envFile = Bun.file(resolve(ROOT, '.env'));
if (await envFile.exists()) {
  const raw = await envFile.text();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!Bun.env[key]) Bun.env[key] = val;
  }
}

const DATABASE_URL =
  Bun.env['DATABASE_URL'] ?? 'postgresql://chimedeck:chimedeck@localhost:5432/chimedeck_dev';

// [context] In production the DB host is not localhost, so PostgreSQL requires SSL.
// Parse the URL to detect local vs remote and configure SSL accordingly, matching
// the logic in db/knexfile.ts and server/common/db.ts.
const dbUrl = new URL(DATABASE_URL);
const isLocal =
  dbUrl.hostname === 'localhost' ||
  dbUrl.hostname === '127.0.0.1' ||
  dbUrl.hostname === 'postgres';

const ADMIN_OWNER = Bun.env['ADMIN_OWNER'];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const db = Knex({
  client: 'pg',
  connection: isLocal
    ? DATABASE_URL
    : {
        host: dbUrl.hostname,
        port: Number.parseInt(dbUrl.port || '5432', 10),
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname.slice(1),
        ssl: { rejectUnauthorized: false },
      },
  pool: { min: 0, max: 1 },
});

try {
  if (!ADMIN_OWNER) {
    console.warn('[0131_admin_owner] ADMIN_OWNER env var is not set — skipping seed.');
    process.exit(0);
  }

  const user = await db('users')
    .select('id', 'email', 'is_admin', 'account_status')
    .where({ email: ADMIN_OWNER })
    .first();

  if (!user) {
    console.warn(
      `[0131_admin_owner] No user found with email "${ADMIN_OWNER}" — skipping seed. ` +
        'Create the user first, then re-run this seed.'
    );
    process.exit(0);
  }

  if (user.is_admin && user.account_status === 'active') {
    console.log(
      `[0131_admin_owner] User "${ADMIN_OWNER}" (${user.id}) is already an active admin — nothing to do.`
    );
    process.exit(0);
  }

  await db('users')
    .where({ id: user.id })
    .update({
      is_admin: true,
      account_status: 'active',
      status_changed_at: db.fn.now(),
      // [why] The seed itself is the "changer" — no human admin performed this.
      // We leave status_changed_by null to indicate a system-initiated promotion.
      status_changed_by: null,
    });

  console.log(
    `[0131_admin_owner] Promoted "${ADMIN_OWNER}" (${user.id}) to platform admin.`
  );
} finally {
  await db.destroy();
}

import { randomBytes } from 'node:crypto';
import type { Knex } from 'knex';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 8;
const BATCH_SIZE = 500;

// Run this migration outside a wrapping transaction so CREATE INDEX CONCURRENTLY
// can be used and long-lived locks are avoided during live rollout.
export const config = { transaction: false };

function makeShortId(): string {
  const bytes = randomBytes(ID_LENGTH);
  let value = '';
  for (let i = 0; i < ID_LENGTH; i += 1) {
    value += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return value;
}

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505';
}

async function tryAssignCandidate(
  knex: Knex,
  tableName: 'boards' | 'cards',
  rowId: string,
  candidate: string,
): Promise<'assigned' | 'already-set' | 'collision'> {
  try {
    const updated = await knex(tableName)
      .where({ id: rowId })
      .whereNull('short_id')
      .update({ short_id: candidate });

    if (updated === 1) return 'assigned';
    return 'already-set';
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return 'collision';
  }
}

async function assignShortIdWithRetry(
  knex: Knex,
  tableName: 'boards' | 'cards',
  rowId: string,
  preferred?: string | null,
): Promise<void> {
  // First try imported short_link for cards when available.
  if (preferred) {
    const preferredResult = await tryAssignCandidate(knex, tableName, rowId, preferred);
    if (preferredResult !== 'collision') return;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = makeShortId();
    const result = await tryAssignCandidate(knex, tableName, rowId, candidate);
    if (result !== 'collision') return;
  }
  throw new Error(`failed-to-assign-short-id:${tableName}:${rowId}`);
}

async function backfillBoards(knex: Knex): Promise<void> {
  while (true) {
    const rows = await knex('boards')
      .select<{ id: string }[]>('id')
      .whereNull('short_id')
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    for (const row of rows) {
      await assignShortIdWithRetry(knex, 'boards', row.id);
    }
  }
}

async function backfillCards(knex: Knex): Promise<void> {
  while (true) {
    const rows = await knex('cards')
      .select<{ id: string; short_link: string | null }[]>('id', 'short_link')
      .whereNull('short_id')
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    for (const row of rows) {
      const preferred =
        typeof row.short_link === 'string' && row.short_link.length === ID_LENGTH
          ? row.short_link
          : null;
      await assignShortIdWithRetry(knex, 'cards', row.id, preferred);
    }
  }
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`SET lock_timeout = '5s'`);
  await knex.raw(`SET statement_timeout = '0'`);

  await knex.raw(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS short_id varchar(8)`);
  await knex.raw(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS short_id varchar(8)`);

  // Partial unique indexes enforce uniqueness for populated rows while allowing
  // incremental backfill without blocking writes.
  await knex.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS boards_short_id_uq_idx
    ON boards(short_id)
    WHERE short_id IS NOT NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS cards_short_id_uq_idx
    ON cards(short_id)
    WHERE short_id IS NOT NULL
  `);

  await backfillBoards(knex);
  await backfillCards(knex);

  const [{ count: boardsMissing }] = await knex('boards')
    .whereNull('short_id')
    .count<{ count: string }[]>({ count: '*' });
  const [{ count: cardsMissing }] = await knex('cards')
    .whereNull('short_id')
    .count<{ count: string }[]>({ count: '*' });

  if (Number(boardsMissing) > 0 || Number(cardsMissing) > 0) {
    throw new Error(`short-id-backfill-incomplete:boards=${boardsMissing},cards=${cardsMissing}`);
  }

  // Add check constraints to enforce non-null semantics without heavy table rewrite.
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'boards_short_id_not_null_ck'
      ) THEN
        ALTER TABLE boards
          ADD CONSTRAINT boards_short_id_not_null_ck
          CHECK (short_id IS NOT NULL) NOT VALID;
      END IF;
    END $$;
  `);
  await knex.raw(`ALTER TABLE boards VALIDATE CONSTRAINT boards_short_id_not_null_ck`);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cards_short_id_not_null_ck'
      ) THEN
        ALTER TABLE cards
          ADD CONSTRAINT cards_short_id_not_null_ck
          CHECK (short_id IS NOT NULL) NOT VALID;
      END IF;
    END $$;
  `);
  await knex.raw(`ALTER TABLE cards VALIDATE CONSTRAINT cards_short_id_not_null_ck`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE boards DROP CONSTRAINT IF EXISTS boards_short_id_not_null_ck`);
  await knex.raw(`ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_short_id_not_null_ck`);

  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS boards_short_id_uq_idx`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS cards_short_id_uq_idx`);

  await knex.raw(`ALTER TABLE boards DROP COLUMN IF EXISTS short_id`);
  await knex.raw(`ALTER TABLE cards DROP COLUMN IF EXISTS short_id`);
}

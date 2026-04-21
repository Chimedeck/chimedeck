import { randomBytes } from 'node:crypto';
import type { Knex } from 'knex';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 8;
const BATCH_SIZE = 500;

export const config = { transaction: false };

type TableName = 'lists' | 'comments' | 'attachments';

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
  tableName: TableName,
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
  tableName: TableName,
  rowId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = makeShortId();
    const result = await tryAssignCandidate(knex, tableName, rowId, candidate);
    if (result !== 'collision') return;
  }
  throw new Error(`failed-to-assign-short-id:${tableName}:${rowId}`);
}

async function backfillTable(knex: Knex, tableName: TableName): Promise<void> {
  while (true) {
    const rows = await knex(tableName)
      .select<{ id: string }[]>('id')
      .whereNull('short_id')
      .limit(BATCH_SIZE);

    if (rows.length === 0) break;

    for (const row of rows) {
      await assignShortIdWithRetry(knex, tableName, row.id);
    }
  }
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`SET lock_timeout = '5s'`);
  await knex.raw(`SET statement_timeout = '0'`);

  await knex.raw(`ALTER TABLE lists ADD COLUMN IF NOT EXISTS short_id varchar(8)`);
  await knex.raw(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS short_id varchar(8)`);
  await knex.raw(`ALTER TABLE attachments ADD COLUMN IF NOT EXISTS short_id varchar(8)`);

  await knex.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS lists_short_id_uq_idx
    ON lists(short_id)
    WHERE short_id IS NOT NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS comments_short_id_uq_idx
    ON comments(short_id)
    WHERE short_id IS NOT NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS attachments_short_id_uq_idx
    ON attachments(short_id)
    WHERE short_id IS NOT NULL
  `);

  await backfillTable(knex, 'lists');
  await backfillTable(knex, 'comments');
  await backfillTable(knex, 'attachments');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS lists_short_id_uq_idx`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS comments_short_id_uq_idx`);
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS attachments_short_id_uq_idx`);

  await knex.raw(`ALTER TABLE lists DROP COLUMN IF EXISTS short_id`);
  await knex.raw(`ALTER TABLE comments DROP COLUMN IF EXISTS short_id`);
  await knex.raw(`ALTER TABLE attachments DROP COLUMN IF EXISTS short_id`);
}

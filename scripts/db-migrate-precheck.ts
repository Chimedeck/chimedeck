import { Client } from 'pg';

type LockRow = { index: number; is_locked: number | boolean };
type ActivityRow = {
  pid: number;
  state: string | null;
  wait_event_type: string | null;
  wait_event: string | null;
  query: string;
  blocking_pids: number[];
};

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://chimedeck:chimedeck@localhost:5432/chimedeck_dev';

async function main(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    const lockRes = await client.query<LockRow>('SELECT * FROM knex_migrations_lock');
    const lock = lockRes.rows[0];

    const blockersRes = await client.query<ActivityRow>(`
      SELECT
        a.pid,
        a.state,
        a.wait_event_type,
        a.wait_event,
        a.query,
        pg_blocking_pids(a.pid) AS blocking_pids
      FROM pg_stat_activity a
      WHERE a.datname = current_database()
        AND a.pid <> pg_backend_pid()
        AND (
          a.state = 'idle in transaction'
          OR a.wait_event_type = 'Lock'
          OR a.query ILIKE '%knex_migrations_lock%'
        )
      ORDER BY a.pid ASC
    `);

    const blockers = blockersRes.rows.filter((row) =>
      row.blocking_pids.length > 0 || row.state === 'idle in transaction',
    );

    console.log('Migration precheck');
    console.log(`- DATABASE_URL: ${databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
    console.log(`- knex_migrations_lock.is_locked: ${String(lock?.is_locked ?? 'unknown')}`);
    console.log(`- blocker sessions: ${blockers.length}`);

    if ((lock?.is_locked === 1 || lock?.is_locked === true) || blockers.length > 0) {
      console.error('\nMigration blockers detected.');

      if (lock?.is_locked === 1 || lock?.is_locked === true) {
        console.error('- knex migration lock is currently set.');
      }

      if (blockers.length > 0) {
        console.error('- Sessions that may block migration:');
        for (const row of blockers) {
          const compact = row.query.replace(/\s+/g, ' ').trim().slice(0, 160);
          console.error(
            `  pid=${row.pid} state=${row.state ?? 'n/a'} wait=${row.wait_event_type ?? 'n/a'}:${row.wait_event ?? 'n/a'} blocking=[${row.blocking_pids.join(',')}] query="${compact}"`,
          );
        }
      }

      console.error('\nRecommended next step: stop app workers/servers holding DB sessions, then retry.');
      process.exitCode = 1;
      return;
    }

    console.log('No blockers found. Safe to run db:migrate.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Precheck failed: ${msg}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();

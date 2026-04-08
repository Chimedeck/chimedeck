// Shared Knex database instance.
// All extensions import from here to reuse the connection pool.
import Knex from 'knex';
import { env } from '../config/env';

const dbUrl = new URL(env.DATABASE_URL);
const isLocal =
  dbUrl.hostname === 'localhost' ||
  dbUrl.hostname === '127.0.0.1' ||
  dbUrl.hostname === 'postgres';

export const db = Knex({
  client: 'pg',
  connection: isLocal
    ? env.DATABASE_URL
    : {
        host: dbUrl.hostname,
        port: Number.parseInt(dbUrl.port || '5432', 10),
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname.slice(1),
        ssl: { rejectUnauthorized: false },
      },
  // min:0 so idle connections are released promptly on hot-reload instead of leaking.
  pool: { min: 0, max: 10 },
});

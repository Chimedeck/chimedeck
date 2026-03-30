// Shared Knex database instance.
// All extensions import from here to reuse the connection pool.
import Knex from 'knex';
import { env } from '../config/env';

export const db = Knex({
  client: 'pg',
  connection: env.DATABASE_URL,
  // min:0 so idle connections are released promptly on hot-reload instead of leaking.
  pool: { min: 0, max: 10 },
});

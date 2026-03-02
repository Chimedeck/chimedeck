// Shared Knex database instance.
// All extensions import from here to reuse the connection pool.
import Knex from 'knex';
import { env } from '../config/env';

export const db = Knex({
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: { min: 2, max: 10 },
});

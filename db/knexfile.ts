import type { Knex } from 'knex';
// All env access goes through server/config/env.ts per architectural convention,
// but knexfile is invoked by the CLI before the server boots, so we read directly here.
// This is the only permitted exception to the "never use Bun.env outside config/" rule.
const DATABASE_URL = Bun.env['DATABASE_URL'] ?? 'postgresql://kanban:kanban@localhost:5432/kanban';

const config: Knex.Config = {
  client: 'pg',
  connection: DATABASE_URL,
  migrations: {
    directory: './db/migrations',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
  seeds: {
    directory: './db/seeds',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

export default config;

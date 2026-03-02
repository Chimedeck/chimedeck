import type { Knex } from 'knex';
// knexfile is invoked by the knex CLI (Node.js), not Bun, so use process.env here.
// This is the only permitted exception to the "never use Bun.env outside config/" rule.
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://kanban:kanban@localhost:5432/kanban_dev';

const config: Knex.Config = {
  client: 'pg',
  connection: DATABASE_URL,
  migrations: {
    // knex CLI changes cwd to the knexfile's directory (db/), so paths are relative to db/
    directory: './migrations',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
  seeds: {
    directory: './seeds',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

export default config;

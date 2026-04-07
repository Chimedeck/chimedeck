import type { Knex } from 'knex';
// knexfile is invoked by the knex CLI (Node.js), not Bun, so use process.env here.
// This is the only permitted exception to the "never use Bun.env outside config/" rule.
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://chimedeck:chimedeck@localhost:5432/chimedeck_dev';

const config: Knex.Config = {
  client: 'pg',
  connection: {
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  },
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

// db/migrations/0022_plugin_data_board_id.ts
// Adds board_id FK to plugin_data for explicit board isolation.
// Drops the old unique constraint and replaces it with one that includes board_id.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugin_data', (table) => {
    table
      .string('board_id')
      .nullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');

    // Drop old unique constraint (knex-generated name)
    table.dropUnique(['plugin_id', 'scope', 'resource_id', 'user_id', 'key']);

    // New unique constraint including board_id
    table.unique(['plugin_id', 'scope', 'resource_id', 'user_id', 'key', 'board_id']);

    // Index for efficient lookup by board_id
    table.index(['board_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plugin_data', (table) => {
    table.dropIndex(['board_id']);
    table.dropUnique(['plugin_id', 'scope', 'resource_id', 'user_id', 'key', 'board_id']);
    table.dropForeign(['board_id']);
    table.dropColumn('board_id');

    // Restore original unique constraint
    table.unique(['plugin_id', 'scope', 'resource_id', 'user_id', 'key']);
  });
}

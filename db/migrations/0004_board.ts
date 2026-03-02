import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('boards', (table) => {
    table.string('id').primary();
    table.string('workspace_id').notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('title').notNullable();
    table.enu('state', ['ACTIVE', 'ARCHIVED']).notNullable().defaultTo('ACTIVE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('boards');
}

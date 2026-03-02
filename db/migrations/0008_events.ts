import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('events', (table) => {
    table.string('id').primary();
    table.string('type').notNullable();
    table.string('board_id').nullable().index();
    table.string('entity_id').notNullable();
    table.string('actor_id').notNullable();
    table.jsonb('payload').notNullable().defaultTo('{}');
    table.bigIncrements('sequence');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['board_id', 'sequence']);
  });

  await knex.schema.createTable('board_snapshots', (table) => {
    table.string('id').primary();
    table.string('board_id').notNullable().unique();
    table.jsonb('state').notNullable().defaultTo('{}');
    table.bigInteger('last_sequence').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['board_id', 'last_sequence']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('board_snapshots');
  await knex.schema.dropTable('events');
}

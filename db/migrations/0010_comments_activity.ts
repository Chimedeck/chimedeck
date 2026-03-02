import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('comments', (table) => {
    table.string('id').primary();
    table.string('card_id').notNullable().references('id').inTable('cards').onDelete('CASCADE');
    table.string('user_id').notNullable().references('id').inTable('users');
    table.text('content').notNullable();
    table.integer('version').notNullable().defaultTo(1);
    table.boolean('deleted').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['card_id', 'created_at']);
  });

  await knex.schema.createTable('activities', (table) => {
    table.string('id').primary();
    table.string('entity_type').notNullable(); // "card" | "board" | "list" | "workspace"
    table.string('entity_id').notNullable();
    table.string('board_id').nullable();
    table.string('action').notNullable(); // e.g. "card_created", "comment_added"
    table.string('actor_id').notNullable();
    table.jsonb('payload').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['entity_id', 'created_at']);
    table.index(['board_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('activities');
  await knex.schema.dropTable('comments');
}

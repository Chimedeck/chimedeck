// db/migrations/0104_comment_reactions.ts
// Creates comment_reactions table for emoji reaction support on comments.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('comment_reactions', (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('comment_id').notNullable().references('id').inTable('comments').onDelete('CASCADE');
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('emoji', 32).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['comment_id', 'user_id', 'emoji']);
  });

  await knex.raw('CREATE INDEX idx_comment_reactions_comment_id ON comment_reactions (comment_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('comment_reactions');
}

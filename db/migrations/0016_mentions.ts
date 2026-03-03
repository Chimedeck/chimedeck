// db/migrations/0016_mentions.ts
// Creates the mentions table — a derived index of @mention references in cards and comments.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('mentions', (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('source_type').notNullable(); // 'card_description' | 'comment'
    table.string('source_id').notNullable();
    table.string('mentioned_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('mentioned_by_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['source_type', 'source_id', 'mentioned_user_id']);
  });

  await knex.raw('CREATE INDEX mentions_mentioned_user_idx ON mentions (mentioned_user_id)');
  await knex.raw('CREATE INDEX mentions_source_idx ON mentions (source_type, source_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mentions');
}

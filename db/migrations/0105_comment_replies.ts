// db/migrations/0105_comment_replies.ts
// Adds parent_id to comments to support one-level threaded replies.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('comments', (table) => {
    table
      .string('parent_id')
      .nullable()
      .references('id')
      .inTable('comments')
      .onDelete('CASCADE');
  });

  await knex.raw('CREATE INDEX idx_comments_parent_id ON comments (parent_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('comments', (table) => {
    table.dropIndex(['parent_id'], 'idx_comments_parent_id');
    table.dropColumn('parent_id');
  });
}

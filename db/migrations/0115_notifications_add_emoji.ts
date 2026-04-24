import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasEmojiColumn = await knex.schema.hasColumn('notifications', 'emoji');
  if (hasEmojiColumn) return;

  await knex.schema.alterTable('notifications', (table) => {
    table.text('emoji').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasEmojiColumn = await knex.schema.hasColumn('notifications', 'emoji');
  if (!hasEmojiColumn) return;

  await knex.schema.alterTable('notifications', (table) => {
    table.dropColumn('emoji');
  });
}

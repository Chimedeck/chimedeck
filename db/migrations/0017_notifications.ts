// db/migrations/0017_notifications.ts
// Creates the notifications table for @mention events.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('type').notNullable(); // 'mention' (extensible)
    table.text('source_type').notNullable(); // 'card_description' | 'comment'
    table.uuid('source_id').notNullable();
    table.uuid('card_id').nullable().references('id').inTable('cards').onDelete('CASCADE');
    table.uuid('board_id').nullable().references('id').inTable('boards').onDelete('CASCADE');
    table.uuid('actor_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.boolean('read').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE INDEX notifications_user_unread_idx ON notifications (user_id, read, created_at DESC)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}

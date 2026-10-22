import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notification_devices', (t) => {
    t.string('id', 64).primary();
    t.string('secret_hash', 64).notNullable();
    t.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('environment', 16).notNullable();
    t.string('platform', 16).notNullable();
    t.text('token').notNullable();
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['environment', 'token']);
  });
  await knex.schema.createTable('notification_push_jobs', (t) => {
    t.bigIncrements('id').primary();
    t.string('notification_id')
      .notNullable()
      .references('id')
      .inTable('notifications')
      .onDelete('CASCADE');
    t.string('device_id', 64)
      .notNullable()
      .references('id')
      .inTable('notification_devices')
      .onDelete('CASCADE');
    t.string('user_id').notNullable();
    t.jsonb('payload').notNullable();
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('next_attempt_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('locked_until', { useTz: true }).nullable();
    t.timestamp('failed_at', { useTz: true }).nullable();
    t.unique(['notification_id', 'device_id']);
    t.index(['next_attempt_at', 'locked_until']);
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notification_push_jobs');
  await knex.schema.dropTableIfExists('notification_devices');
}

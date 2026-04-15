// db/migrations/0106_webhooks.ts
// Sprint 135 — Webhooks infrastructure.
// Creates webhooks (registration) and webhook_deliveries (delivery log) tables.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('webhooks', (t) => {
    // [why] string type matches the project-wide convention for all ID columns
    t.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    t.string('created_by').notNullable().references('id').inTable('users');
    t.string('label').notNullable();
    t.string('endpoint_url').notNullable();
    // [why] signing_secret stored in plain text — it is a user-facing credential revealed once;
    // hashing it would prevent server-side HMAC re-derivation.
    t.string('signing_secret').notNullable();
    // [why] event_types stored as jsonb array — allows partial-index queries and future array operators.
    t.jsonb('event_types').notNullable().defaultTo('[]');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('webhook_deliveries', (t) => {
    t.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('webhook_id').notNullable().references('id').inTable('webhooks').onDelete('CASCADE');
    t.string('event_type').notNullable();
    t.jsonb('payload').notNullable();
    t.integer('http_status').nullable();
    t.text('response_body').nullable();
    t.integer('attempt').notNullable().defaultTo(1);
    // [why] status enum covers the delivery lifecycle without extra joins
    t.enum('status', ['pending', 'delivered', 'failed']).notNullable().defaultTo('pending');
    t.timestamp('delivered_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webhook_deliveries');
  await knex.schema.dropTableIfExists('webhooks');
}

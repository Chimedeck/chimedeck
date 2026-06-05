import type { Knex } from 'knex';

const TABLE_NAME = 'workspace_subscriptions';
const WORKSPACE_INDEX = 'idx_workspace_subscriptions_workspace_id';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    // [context] One canonical subscription row per workspace keeps tier resolution deterministic.
    table
      .string('workspace_id')
      .primary()
      .references('id')
      .inTable('workspaces')
      .onDelete('CASCADE');
    table.enu('tier', ['tier_1', 'tier_2', 'unlimited']).notNullable().defaultTo('tier_1');
    table
      .enu('status', ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'])
      .notNullable()
      .defaultTo('active');
    table.string('stripe_customer_id').unique();
    table.string('stripe_subscription_id').unique();
    table.string('stripe_price_id');
    table.timestamp('stripe_current_period_end', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.index(['workspace_id'], WORKSPACE_INDEX);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}

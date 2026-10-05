import type { Knex } from 'knex';

const TABLE_NAME = 'user_subscriptions';
const USER_INDEX = 'idx_user_subscriptions_user_id';

const TIER_VALUES = ['tier_1', 'tier_2', 'tier_3', 'tier_4', 'unlimited'];
const STATUS_VALUES = ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table
      .string('user_id')
      .primary()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    table.enu('tier', TIER_VALUES).notNullable().defaultTo('tier_1');
    table.enu('status', STATUS_VALUES).notNullable().defaultTo('active');
    table.string('stripe_customer_id').unique();
    table.string('stripe_subscription_id').unique();
    table.string('stripe_price_id');
    table.timestamp('stripe_current_period_end', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.index(['user_id'], USER_INDEX);
  });

  // Backfill one canonical user subscription from existing workspace-scoped rows.
  // Preference order: strongest tier first, then latest update timestamp.
  await knex.raw(`
    WITH ranked AS (
      SELECT
        w.owner_id AS user_id,
        ws.tier,
        ws.status,
        ws.stripe_customer_id,
        ws.stripe_subscription_id,
        ws.stripe_price_id,
        ws.stripe_current_period_end,
        ws.created_at,
        ws.updated_at,
        ROW_NUMBER() OVER (
          PARTITION BY w.owner_id
          ORDER BY
            CASE ws.tier
              WHEN 'unlimited' THEN 5
              WHEN 'tier_4' THEN 4
              WHEN 'tier_3' THEN 3
              WHEN 'tier_2' THEN 2
              ELSE 1
            END DESC,
            ws.updated_at DESC,
            ws.created_at DESC
        ) AS rn
      FROM workspace_subscriptions ws
      INNER JOIN workspaces w ON w.id = ws.workspace_id
    )
    INSERT INTO user_subscriptions (
      user_id,
      tier,
      status,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      stripe_current_period_end,
      created_at,
      updated_at
    )
    SELECT
      user_id,
      tier,
      status,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      stripe_current_period_end,
      created_at,
      updated_at
    FROM ranked
    WHERE rn = 1
    ON CONFLICT (user_id) DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}

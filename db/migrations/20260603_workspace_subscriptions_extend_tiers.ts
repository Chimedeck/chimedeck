const TABLE_NAME = 'workspace_subscriptions';
const TIER_CHECK_NAME = 'workspace_subscriptions_tier_check';

const EXTENDED_CHECK = "tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4', 'unlimited')";
const PREV_CHECK = "tier IN ('tier_1', 'tier_2', 'unlimited')";

export async function up(knex: any): Promise<void> {
  await knex.raw(
    `ALTER TABLE ${TABLE_NAME} DROP CONSTRAINT IF EXISTS ${TIER_CHECK_NAME}`,
  );
  await knex.raw(
    `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT ${TIER_CHECK_NAME} CHECK (${EXTENDED_CHECK})`,
  );
}

export async function down(knex: any): Promise<void> {
  await knex.raw(
    `ALTER TABLE ${TABLE_NAME} DROP CONSTRAINT IF EXISTS ${TIER_CHECK_NAME}`,
  );
  await knex.raw(
    `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT ${TIER_CHECK_NAME} CHECK (${PREV_CHECK})`,
  );
}

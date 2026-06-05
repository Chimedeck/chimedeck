// db/migrations/0123_github_app_installations.ts
// Persist GitHub App installation state so we can:
//   1. Look up the per-installation webhook signing secret (encrypted with
//      WEBHOUB_SECRET_ENCRYPTION_KEY) on every incoming webhook.
//   2. Cache the set of repositories accessible to each installation so the
//      `installation_repositories` event can be processed idempotently and so
//      the existing board-docs sync flow can resolve tokens without a round
//      trip to GitHub on every read.
//
// One row per installation. A workspace may be linked to multiple installations
// (e.g. one for org-level repos and one for a personal account) — the
// `account_login` + `account_type` pair lets us disambiguate.
//
// The webhook secret column is encrypted at rest using the same AES-256-GCM
// scheme the outgoing webhooks system uses; see server/extensions/webhooks/mods/sign.ts
// for the canonical implementation.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('github_app_installations', (table) => {
    table.string('installation_id').primary();
    // account_login + account_type come straight from the GitHub installation payload
    // and let us look up an installation without making a GitHub API call.
    table.string('account_login').notNullable();
    table.string('account_type').notNullable(); // 'User' | 'Organization'
    // Optional workspace binding — populated by the app install flow once the
    // user picks a destination workspace. Nullable because installations can
    // exist before the user finishes the in-app setup wizard.
    table.string('workspace_id').nullable();
    table
      .foreign('workspace_id')
      .references('id')
      .inTable('workspaces')
      .onDelete('SET NULL');
    // Cached repo list (denormalised JSON) so the `push` webhook handler can
    // match `repository.full_name` to a board without a GitHub round trip.
    table.jsonb('repositories').notNullable().defaultTo('[]');
    // Suspended installations still send webhooks; we must acknowledge them
    // with 202 but skip any work that requires a token.
    table.boolean('suspended').notNullable().defaultTo(false);
    // Per-installation webhook signing secret — encrypted at rest.
    // Nullable: the very first `installation.created` event is verified using
    // the GITHUB_APP_WEBHOOK_SECRET fallback before we have anything to store.
    table.text('webhook_secret_encrypted').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw(`
    CREATE INDEX github_app_installations_workspace_id_idx
      ON github_app_installations (workspace_id)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('github_app_installations');
}

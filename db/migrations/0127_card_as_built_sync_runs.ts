// Sprint 176 — As-Built Sync run tracking.
// [why] Every as-built sync execution is tracked as a run with status,
// evidence, and output paths for full auditability.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('card_as_built_sync_runs', (table) => {
    table.uuid('id').primary();
    table.string('card_id', 255).notNullable().references('id').inTable('cards').onDelete('cascade');
    table.string('workspace_id', 255).notNullable().references('id').inTable('workspaces').onDelete('cascade');
    table.string('created_by', 255).notNullable().references('id').inTable('users').onDelete('cascade');

    // Run status follows the trigger engine pattern:
    // QUEUED → RUNNING → SUCCEEDED | FAILED.
    table.string('status', 32).notNullable().defaultTo('QUEUED');

    // Foreign key to the trigger run that initiated this sync.
    table.uuid('trigger_run_id').nullable();

    // JSON: the evidence collected during the sync (merged PRs, changed files, etc.).
    table.jsonb('evidence').nullable();

    // JSON array of output file paths updated/created by this run.
    table.jsonb('output_files').nullable();

    // Commit hash from the as-built sync commit.
    table.string('commit_hash', 40).nullable();

    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();

    // Index for querying runs by card.
    table.index('card_id', 'idx_as_built_sync_runs_card');
    // Index for looking up by trigger run.
    table.index('trigger_run_id', 'idx_as_built_sync_runs_trigger');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_as_built_sync_runs');
}

// Sprint 176 — Sprint generation run tracking.
// [why] Every sprint generation execution is tracked as a run with status,
// tier, input snapshot FK, and output file paths for full auditability.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('card_sprint_generation_runs', (table) => {
    table.uuid('id').primary();
    table.string('card_id', 255).notNullable().references('id').inTable('cards').onDelete('cascade');
    table.string('workspace_id', 255).notNullable().references('id').inTable('workspaces').onDelete('cascade');
    table.string('created_by', 255).notNullable().references('id').inTable('users').onDelete('cascade');

    // Run status follows the trigger engine pattern:
    // QUEUED → RUNNING → SUCCEEDED | FAILED.
    table.string('status', 32).notNullable().defaultTo('QUEUED');
    table.string('tier', 32).nullable();

    // Foreign key to the context snapshot used as input.
    table.string('snapshot_id').nullable();

    // Foreign key to the trigger run that initiated this generation.
    table.uuid('trigger_run_id').nullable();

    // JSON array of output file paths created by this run.
    table.jsonb('output_files').nullable();

    // JSON: the requirement packet extracted from the card chat session.
    table.jsonb('requirement_packet').nullable();

    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();

    // Index for querying runs by card.
    table.index('card_id', 'idx_sprint_gen_runs_card');
    // Index for looking up by trigger run.
    table.index('trigger_run_id', 'idx_sprint_gen_runs_trigger');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_sprint_generation_runs');
}

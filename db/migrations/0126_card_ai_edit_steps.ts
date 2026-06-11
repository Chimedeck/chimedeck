import type { Knex } from 'knex';

/**
 * Sprint 175 — AI Edit Orchestrator: step tracking table.
 *
 * card_ai_edit_steps records each pipeline step within a run.
 * Each step is named (context_gather, file_scope_plan, files_create,
 * files_edit, commit) and tracked with status, attempt count, inputs,
 * and outputs. The UNIQUE constraint on (run_id, step_name) ensures
 * one row per step — retries update the existing row with incremented
 * attempt count.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('card_ai_edit_steps', (table) => {
    table.string('id', 36).primary(); // UUIDv4
    table
      .string('run_id', 36)
      .notNullable()
      .references('id')
      .inTable('card_ai_edit_runs')
      .onDelete('CASCADE');
    table
      .string('step_name', 64)
      .notNullable()
      .checkIn([
        'context_gather',
        'file_scope_plan',
        'files_create',
        'files_edit',
        'commit',
      ]);
    table
      .string('status', 16)
      .notNullable()
      .defaultTo('PENDING')
      .checkIn(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']);
    table.integer('attempt').notNullable().defaultTo(1);
    table.jsonb('input').nullable();
    table.jsonb('output').nullable();
    table.jsonb('error').nullable();
    table.timestamp('started_at', { useTz: true }).nullable();
    table.timestamp('completed_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // [why] Fast lookup of all steps for a given run.
    table.index(['run_id', 'step_name'], 'idx_card_ai_edit_steps_run_step');
    // [why] Guarantee one row per step per run.
    table.unique(['run_id', 'step_name'], 'uq_card_ai_edit_steps_run_step');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_ai_edit_steps');
}

import type { Knex } from 'knex';

/**
 * Sprint 175 — AI Edit Orchestrator: run tracking table.
 *
 * card_ai_edit_runs tracks each editing session triggered by POST /ai/edit.
 * One run per card intent; progresses through a linear state machine:
 * REQUESTED → CONTEXT_GATHERED → FILE_SCOPE_PLANNED → FILES_CREATED →
 * FILES_EDITED → COMMITTED, or any non-terminal → FAILED.
 *
 * Each run stores a reference to the context snapshot (card_ai_context_snapshots)
 * and the file scope plan for traceability.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('card_ai_edit_runs', (table) => {
    table.string('id', 36).primary(); // UUIDv4
    table.string('card_id', 255).notNullable().references('id').inTable('cards').onDelete('CASCADE');
    table.string('workspace_id', 255).notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('created_by', 255).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table
      .string('status', 32)
      .notNullable()
      .defaultTo('REQUESTED')
      .checkIn([
        'REQUESTED',
        'CONTEXT_GATHERED',
        'FILE_SCOPE_PLANNED',
        'FILES_CREATED',
        'FILES_EDITED',
        'COMMITTED',
        'FAILED',
      ]);
    // [why] Reference to the context snapshot for traceability — nullable until CONTEXT_GATHERED.
    table.string('snapshot_id', 36).nullable();
    // [why] Store the file scope plan as JSONB for queryability.
    table.jsonb('file_scope_plan').nullable();
    // [why] Error message captured on FAILED transition.
    table.text('error_message').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at', { useTz: true }).nullable();

    table.index('card_id', 'idx_card_ai_edit_runs_card_id');
    table.index('workspace_id', 'idx_card_ai_edit_runs_workspace_id');
    table.index('status', 'idx_card_ai_edit_runs_status');
    table.index(['card_id', 'status'], 'idx_card_ai_edit_runs_card_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_ai_edit_runs');
}

import type { Knex } from 'knex';

/**
 * Create card_ai_context_snapshots table for Sprint 174 Part 2.
 * [why] Every AI context gather call produces an immutable snapshot
 * linked to the card and intent. Later execution runs (Sprint 175 AI
 * Edit Orchestrator) reference these snapshots for traceability and
 * reproducibility.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('card_ai_context_snapshots', (table) => {
    table.string('id').primary();
    table.string('card_id').notNullable();
    table.string('intent').notNullable();
    // [why] SHA-256 hash of chunks_json for immutability and dedup.
    table.string('snapshot_hash').notNullable();
    table.integer('total_chunks').notNullable().defaultTo(0);
    // [why] JSONB for queryable chunk metadata (e.g. source counts).
    table.jsonb('chunks_json').notNullable();
    table.jsonb('budget_json').notNullable().defaultTo('{}');
    // [why] Store focus paths as JSON array for audit.
    table.jsonb('focus_paths').nullable().defaultTo(null);
    // [why] created_at for ordering and pruning old snapshots.
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // [why] Index on card_id for fast lookups by card.
    table.index('card_id', 'idx_card_ai_context_snapshots_card_id');
    // [why] Index on snapshot_hash for dedup checks.
    table.index('snapshot_hash', 'idx_card_ai_context_snapshots_hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_ai_context_snapshots');
}

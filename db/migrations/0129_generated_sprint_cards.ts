// Sprint 176 — Generated sprint card traceability.
// [why] Each sprint generated from a feature card is tracked as a child card
// with a link back to the originating feature card and generation run for
// full end-to-end traceability.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('generated_sprint_cards', (table) => {
    table.uuid('id').primary();

    // The child sprint card in the board.
    table.string('sprint_card_id', 255).notNullable().references('id').inTable('cards').onDelete('cascade');

    // The originating feature card.
    table.string('feature_card_id', 255).notNullable().references('id').inTable('cards').onDelete('cascade');

    // The generation run that produced this sprint mapping.
    table.uuid('sprint_generation_run_id').notNullable()
      .references('id').inTable('card_sprint_generation_runs').onDelete('cascade');

    // The sprint number (1-based, e.g. 1 for the first sprint generated).
    table.integer('sprint_number').notNullable();

    // Relative path to the sprint spec file (e.g. specs/sprints/sprint-1.md).
    table.string('sprint_spec_path', 512).nullable();

    // JSON: trace links to other artifacts (changelog, architecture diff, etc.).
    table.jsonb('trace_links').nullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Unique constraint — one sprint number per generation run.
    table.unique(['sprint_generation_run_id', 'sprint_number'], 'uq_gen_sprint_run_number');
    // Index for looking up all sprints for a feature card.
    table.index('feature_card_id', 'idx_gen_sprint_feature');
    // Index for looking up which generation run produced a sprint card.
    table.index('sprint_generation_run_id', 'idx_gen_sprint_run');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('generated_sprint_cards');
}

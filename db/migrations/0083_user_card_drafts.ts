// db/migrations/0083_user_card_drafts.ts
// Sprint 83 — offline draft persistence for card descriptions and comments.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_card_drafts', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('card_id').notNullable().references('id').inTable('cards').onDelete('CASCADE');
    // [why] draft_type distinguishes per-card drafts: one for the card description, one per comment compose box
    table.enu('draft_type', ['description', 'comment']).notNullable();
    table.text('content_markdown').notNullable().defaultTo('');
    // [why] intent tracks what the client intended when it last saved: actively editing,
    //        waiting to save the description (save_pending), or waiting to post a comment (submit_pending)
    table.enu('intent', ['editing', 'save_pending', 'submit_pending']).notNullable().defaultTo('editing');
    // [why] client_updated_at is the client-side timestamp used for last-write-wins reconciliation across devices
    table.timestamp('client_updated_at', { useTz: true }).notNullable();
    // [why] synced_at is null until the server acknowledges a successful sync round-trip
    table.timestamp('synced_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // One draft row per (user, card, type) — upsert semantics on the server
    table.unique(['user_id', 'card_id', 'draft_type']);
  });

  // Fast lookup of all drafts for a user, ordered by most-recently touched
  await knex.schema.table('user_card_drafts', (table) => {
    table.index(['user_id', 'updated_at'], 'idx_user_card_drafts_user_updated_at');
    table.index(['card_id'], 'idx_user_card_drafts_card_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_card_drafts');
}

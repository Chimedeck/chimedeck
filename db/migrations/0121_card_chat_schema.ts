import type { Knex } from 'knex';

/**
 * Sprint 171 — card-scoped chat session model.
 *
 * card_chat_sessions: one active session per card (not per user).
 * card_chat_messages: user + AI messages linked to a session.
 *
 * Session state machine: IDLE → ACTIVE_REFINEMENT → PAUSED → READY_FOR_REVIEW.
 * Messages can only be written when session is in ACTIVE_REFINEMENT.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('card_chat_sessions', (table) => {
    table.string('id', 36).primary(); // UUIDv4
    table.string('card_id', 255).notNullable().references('id').inTable('cards').onDelete('CASCADE');
    table.string('workspace_id', 255).notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('created_by', 255).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table
      .string('status', 32)
      .notNullable()
      .defaultTo('ACTIVE_REFINEMENT')
      .checkIn(['ACTIVE_REFINEMENT', 'PAUSED', 'READY_FOR_REVIEW']);
    table.integer('quality_score').nullable(); // 0–100, set by scoring loop (future iteration)
    table.timestamp('last_actor_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // One active session per card — enforced at app level, not via partial unique index
    table.index('card_id', 'idx_card_chat_sessions_card_id');
    table.index('workspace_id', 'idx_card_chat_sessions_workspace_id');
    table.index('status', 'idx_card_chat_sessions_status');
    table.index(['card_id', 'status'], 'idx_card_chat_sessions_card_status');
  });

  await knex.schema.createTable('card_chat_messages', (table) => {
    table.string('id', 36).primary(); // UUIDv4
    table.string('session_id', 36).notNullable().references('id').inTable('card_chat_sessions').onDelete('CASCADE');
    table.string('role', 32).notNullable().checkIn(['user', 'assistant', 'system', 'tool']);
    table.text('content').notNullable();
    table.text('metadata').nullable(); // JSON string — provider info, tool calls, etc.
    table.string('author_id', 255).nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Composite index for cursor pagination by (created_at, id)
    table.index(['session_id', 'created_at', 'id'], 'idx_card_chat_messages_session_time_id');
    table.index('session_id', 'idx_card_chat_messages_session_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('card_chat_messages');
  await knex.schema.dropTableIfExists('card_chat_sessions');
}

import type { Knex } from 'knex';

/**
 * Store MCP (Model Context Protocol) sessions in the database so all backend
 * instances share the same session metadata. Transport objects remain
 * per-instance in a local in-memory Map — if a request hits an instance that
 * doesn't have the transport cached, the client receives a 404 and
 * re-initializes (standard MCP pattern for horizontal scaling).
 *
 * No cookie is needed — session identity travels via the mcp-session-id header.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('mcp_sessions', (table) => {
    table.string('id', 36).primary(); // UUIDv4
    table.string('user_id', 255).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('last_active_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('user_id', 'idx_mcp_sessions_user_id');
    table.index('last_active_at', 'idx_mcp_sessions_last_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mcp_sessions');
}

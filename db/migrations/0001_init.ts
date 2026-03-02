import type { Knex } from 'knex';

// Baseline migration — establishes migration history. No schema changes.
export async function up(_knex: Knex): Promise<void> {}
export async function down(_knex: Knex): Promise<void> {}

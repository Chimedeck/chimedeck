// db/migrations/0012_search_vectors.ts
// Adds tsvector columns, triggers, GIN indexes, and backfills existing rows.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add tsvector generated columns
  await knex.schema.alterTable('boards', (table) => {
    table.specificType('search_vector', 'tsvector');
  });
  await knex.schema.alterTable('cards', (table) => {
    table.specificType('search_vector', 'tsvector');
  });

  // Triggers keep vectors in sync on INSERT / UPDATE
  await knex.raw(`
    CREATE TRIGGER boards_search_vector_update
    BEFORE INSERT OR UPDATE ON boards
    FOR EACH ROW EXECUTE FUNCTION
      tsvector_update_trigger(search_vector, 'pg_catalog.english', title);
  `);
  await knex.raw(`
    CREATE TRIGGER cards_search_vector_update
    BEFORE INSERT OR UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION
      tsvector_update_trigger(search_vector, 'pg_catalog.english', title, description);
  `);

  // GIN indexes for fast full-text search
  await knex.raw(`CREATE INDEX boards_search_idx ON boards USING GIN (search_vector)`);
  await knex.raw(`CREATE INDEX cards_search_idx  ON cards  USING GIN (search_vector)`);

  // Backfill existing rows so they're immediately searchable
  await knex.raw(`UPDATE boards SET search_vector = to_tsvector('english', coalesce(title, ''))`);
  await knex.raw(
    `UPDATE cards SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS cards_search_idx`);
  await knex.raw(`DROP INDEX IF EXISTS boards_search_idx`);
  await knex.raw(`DROP TRIGGER IF EXISTS cards_search_vector_update ON cards`);
  await knex.raw(`DROP TRIGGER IF EXISTS boards_search_vector_update ON boards`);
  await knex.schema.alterTable('cards', (table) => {
    table.dropColumn('search_vector');
  });
  await knex.schema.alterTable('boards', (table) => {
    table.dropColumn('search_vector');
  });
}

// Fix: fractional-index position columns must sort bytewise (COLLATE "C") to match
// JavaScript's string comparison order. Without this, locale-aware collations (e.g.
// en_US.UTF-8) place uppercase letters like 'W' *after* lowercase 'j' alphabetically,
// causing `between(after, next)` to throw when the DB returns them in locale order.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE lists ALTER COLUMN position TYPE text COLLATE "C"');
  await knex.raw('ALTER TABLE cards ALTER COLUMN position TYPE text COLLATE "C"');
  await knex.raw('ALTER TABLE checklist_items ALTER COLUMN position TYPE text COLLATE "C"');
}

export async function down(knex: Knex): Promise<void> {
  // Revert to the database default collation
  await knex.raw('ALTER TABLE lists ALTER COLUMN position TYPE text COLLATE "default"');
  await knex.raw('ALTER TABLE cards ALTER COLUMN position TYPE text COLLATE "default"');
  await knex.raw('ALTER TABLE checklist_items ALTER COLUMN position TYPE text COLLATE "default"');
}

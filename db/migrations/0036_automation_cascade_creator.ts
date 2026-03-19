// Drop and recreate the automations.created_by FK with ON DELETE CASCADE so that
// when a user is deleted all automations they created are automatically removed.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE automations
      DROP CONSTRAINT IF EXISTS automations_created_by_foreign;

    ALTER TABLE automations
      ADD CONSTRAINT automations_created_by_foreign
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE CASCADE;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE automations
      DROP CONSTRAINT IF EXISTS automations_created_by_foreign;

    ALTER TABLE automations
      ADD CONSTRAINT automations_created_by_foreign
        FOREIGN KEY (created_by)
        REFERENCES users(id);
  `);
}

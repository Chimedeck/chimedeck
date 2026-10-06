import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.text('github_branch').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('boards', (table) => {
    table.dropColumn('github_branch');
  });
}

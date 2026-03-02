import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('workspaces', (table) => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('owner_id').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('memberships', (table) => {
    table.string('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('workspace_id').notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.enu('role', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).notNullable();
    table.primary(['user_id', 'workspace_id']);
  });

  await knex.schema.createTable('invites', (table) => {
    table.string('id').primary();
    table.string('workspace_id').notNullable()
      .references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('invited_email').notNullable();
    table.string('token').notNullable().unique(); // stored also in cache with TTL
    table.enu('role', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).notNullable().defaultTo('MEMBER');
    table.timestamp('accepted_at');
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('invites');
  await knex.schema.dropTable('memberships');
  await knex.schema.dropTable('workspaces');
}

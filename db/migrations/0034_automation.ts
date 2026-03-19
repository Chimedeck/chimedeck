// Sprint 61 — Automation system DB schema.
// Creates four tables: automations, automation_triggers, automation_actions, automation_run_log.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Top-level record: one entry per rule / button / scheduled command
  await knex.schema.createTable('automations', (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('board_id').notNullable().references('id').inTable('boards').onDelete('CASCADE');
    table.string('created_by').notNullable().references('id').inTable('users');
    table.string('name', 255).notNullable();
    table
      .enu('automation_type', ['RULE', 'CARD_BUTTON', 'BOARD_BUTTON', 'SCHEDULED', 'DUE_DATE'])
      .notNullable();
    table.boolean('is_enabled').notNullable().defaultTo(true);
    table.string('icon', 64).nullable();
    table.integer('run_count').notNullable().defaultTo(0);
    table.timestamp('last_run_at', { useTz: true }).nullable();
    table.timestamps(true, true);
  });

  // Exactly one trigger per RULE / DUE_DATE automation
  await knex.schema.createTable('automation_triggers', (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .string('automation_id')
      .notNullable()
      .references('id')
      .inTable('automations')
      .onDelete('CASCADE');
    table.string('trigger_type', 64).notNullable();
    table.jsonb('config').notNullable().defaultTo('{}');
    // One trigger per automation
    table.unique(['automation_id']);
  });

  // Ordered list of actions to run when automation fires
  await knex.schema.createTable('automation_actions', (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .string('automation_id')
      .notNullable()
      .references('id')
      .inTable('automations')
      .onDelete('CASCADE');
    table.integer('position').notNullable().defaultTo(0);
    table.string('action_type', 64).notNullable();
    table.jsonb('config').notNullable().defaultTo('{}');
  });

  // Immutable audit log; at most 1000 rows retained per automation (oldest purged)
  await knex.schema.createTable('automation_run_log', (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .string('automation_id')
      .notNullable()
      .references('id')
      .inTable('automations')
      .onDelete('CASCADE');
    table.string('triggered_by_user_id').nullable().references('id').inTable('users');
    table
      .string('card_id')
      .nullable()
      .references('id')
      .inTable('cards')
      .onDelete('SET NULL');
    table.enu('status', ['SUCCESS', 'PARTIAL', 'FAILED']).notNullable();
    table.jsonb('context').notNullable().defaultTo('{}');
    table.text('error_message').nullable();
    table.timestamp('ran_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('automation_run_log');
  await knex.schema.dropTableIfExists('automation_actions');
  await knex.schema.dropTableIfExists('automation_triggers');
  await knex.schema.dropTableIfExists('automations');
}

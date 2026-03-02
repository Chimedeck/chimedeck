import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('attachments', (table) => {
    table.string('id').primary();
    table.string('card_id').notNullable().references('id').inTable('cards').onDelete('CASCADE');
    table.string('uploaded_by').notNullable().references('id').inTable('users');
    table.string('name').notNullable();
    // AttachmentType: FILE | URL
    table.string('type').notNullable();

    // FILE fields
    table.string('s3_key').nullable();
    table.string('s3_bucket').nullable();
    table.string('mime_type').nullable();
    table.integer('size_bytes').nullable();
    // AttachmentStatus: PENDING | READY | REJECTED (FILE only)
    table.string('status').notNullable().defaultTo('PENDING');

    // URL field
    table.text('url').nullable();

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['card_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('attachments');
}

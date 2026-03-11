// Sprint 59 — extend the attachments table with thumbnail, content-type,
// image dimensions, and virus-scan tracking columns.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    // S3 key for the auto-generated WebP thumbnail (images only)
    table.string('thumbnail_key').nullable();
    // Validated MIME type, confirmed via S3 HEAD after upload completes
    table.string('content_type', 128).nullable();
    // Image dimensions populated by the thumbnail worker
    table.integer('width').nullable();
    table.integer('height').nullable();
    // Virus scan tracking
    table.timestamp('scan_completed_at', { useTz: true }).nullable();
    table.string('scan_vendor', 64).nullable(); // e.g. "clamav", "mock"
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (table) => {
    table.dropColumn('thumbnail_key');
    table.dropColumn('content_type');
    table.dropColumn('width');
    table.dropColumn('height');
    table.dropColumn('scan_completed_at');
    table.dropColumn('scan_vendor');
  });
}

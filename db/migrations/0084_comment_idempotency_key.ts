// db/migrations/0084_comment_idempotency_key.ts
// Sprint 83 — add idempotency_key column to comments table to support offline replay.
// [why] When a client submits a comment while offline and replays after reconnect,
//        the idempotency_key lets the server recognise a duplicate and return the
//        already-created comment rather than inserting a second row.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('comments', (table) => {
    table.string('idempotency_key').nullable();
    // [why] Scoped per user so two users can independently use the same client-generated key
    //        without conflicting with each other.
    table.unique(['user_id', 'idempotency_key'], {
      indexName: 'comments_user_id_idempotency_key_unique',
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('comments', (table) => {
    table.dropUnique(['user_id', 'idempotency_key'], 'comments_user_id_idempotency_key_unique');
    table.dropColumn('idempotency_key');
  });
}

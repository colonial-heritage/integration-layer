import {Database} from '../types.js';
import {Kysely, sql} from 'kysely';

export async function up(db: Kysely<Database>) {
  await db.schema
    .createTable('queue')
    .addColumn('id', 'integer', col => col.primaryKey().notNull())
    .addColumn('iri', 'text', col => col.notNull())
    .addColumn('type', 'text')
    .addColumn('retry_count', 'integer', col => col.defaultTo(0).notNull())
    .addColumn('created_at', 'text', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'text', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  await db.schema
    .createIndex('queue_type')
    .on('queue')
    .columns(['type'])
    .execute();
}

export async function down(db: Kysely<Database>) {
  await db.schema.dropIndex('queue_type').execute();
  await db.schema.dropTable('queue').execute();
}

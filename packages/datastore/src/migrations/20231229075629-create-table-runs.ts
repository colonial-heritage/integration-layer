import {Database} from '../types.js';
import {Kysely, sql} from 'kysely';

export async function up(db: Kysely<Database>) {
  await db.schema
    .createTable('runs')
    .addColumn('id', 'integer', col => col.primaryKey().notNull())
    .addColumn('identifier', 'text', col => col.notNull())
    .addColumn('created_at', 'text', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'text', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<Database>) {
  await db.schema.dropTable('runs').execute();
}

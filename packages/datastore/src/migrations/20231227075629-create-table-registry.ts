import {Database} from '../types.js';
import {Kysely, sql} from 'kysely';

export async function up(db: Kysely<Database>) {
  await db.schema
    .createTable('registry')
    .addColumn('id', 'integer', col => col.primaryKey().notNull())
    .addColumn('iri', 'text', col => col.notNull().unique())
    .addColumn('type', 'text')
    .addColumn('created_at', 'text', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'text', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  await db.schema
    .createIndex('registry_type')
    .on('registry')
    .columns(['type'])
    .execute();
}

export async function down(db: Kysely<Database>) {
  await db.schema.dropIndex('registry_type').execute();
  await db.schema.dropTable('registry').execute();
}

import {Connection} from './connection.js';
import {Database, NewRegistryItem} from './types.js';
import {Kysely, sql} from 'kysely';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  connection: z.instanceof(Connection),
});

export type RegistryConstructorOptions = z.input<
  typeof constructorOptionsSchema
>;

const removeIfNotInQueueOptionsSchema = z
  .object({
    type: z.string().optional(),
  })
  .default({});

export type RemoveIfNotInQueueOptions = z.input<
  typeof removeIfNotInQueueOptionsSchema
>;

export class Registry {
  private db: Kysely<Database>;

  constructor(options: RegistryConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.db = opts.connection.db;
  }

  async getAll() {
    return this.db.selectFrom('registry').selectAll().execute();
  }

  async save(item: NewRegistryItem) {
    // Update if the item already exists
    return this.db
      .insertInto('registry')
      .values({iri: item.iri, type: item.type})
      .onConflict(oc =>
        oc.column('iri').doUpdateSet({updated_at: sql`CURRENT_TIMESTAMP`})
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async removeIfNotInQueue(options?: RemoveIfNotInQueueOptions) {
    const opts = removeIfNotInQueueOptionsSchema.parse(options);

    let inQueueQuery = this.db.selectFrom('queue').select('iri');
    if (opts.type !== undefined) {
      inQueueQuery = inQueueQuery.where('type', '=', opts.type);
    }

    let selectQuery = this.db
      .selectFrom('registry')
      .where('iri', 'not in', inQueueQuery)
      .selectAll();

    if (opts.type !== undefined) {
      selectQuery = selectQuery.where('type', '=', opts.type);
    }

    const removedItems = await selectQuery.execute();

    if (removedItems.length > 0) {
      // Beware: if the queue is empty all items will be removed
      let deleteQuery = this.db
        .deleteFrom('registry')
        .where('iri', 'not in', inQueueQuery);

      if (opts.type !== undefined) {
        deleteQuery = deleteQuery.where('type', '=', opts.type);
      }

      await deleteQuery.execute();
    }

    return removedItems;
  }
}

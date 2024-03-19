import {Connection} from './connection.js';
import {Registry} from './registry.js';
import {Database, QueueItem, NewQueueItem} from './types.js';
import {Kysely, sql} from 'kysely';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  connection: z.instanceof(Connection),
  maxRetryCount: z.number().int().min(0).default(2), // Three attempts in total: original + two retries
});

export type QueueConstructorOptions = z.input<typeof constructorOptionsSchema>;

const getAllOptionsSchema = z
  .object({
    type: z.string().optional(),
    limit: z.number().int().min(1).optional(),
  })
  .default({});

export type GetAllOptions = z.input<typeof getAllOptionsSchema>;

const sizeOptionsSchema = z
  .object({
    type: z.string().optional(),
  })
  .default({});

export type SizeOptions = z.input<typeof sizeOptionsSchema>;

export class Queue {
  private db: Kysely<Database>;
  private readonly maxRetryCount: number;
  private readonly registry: Registry;

  constructor(options: QueueConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.db = opts.connection.db;
    this.maxRetryCount = opts.maxRetryCount;
    this.registry = new Registry({connection: opts.connection});
  }

  async push(item: NewQueueItem) {
    // Update if the item already exists
    return this.db
      .insertInto('queue')
      .values(item)
      .onConflict(oc =>
        oc.column('iri').doUpdateSet({updated_at: sql`CURRENT_TIMESTAMP`})
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async remove(iri: string) {
    await this.db.deleteFrom('queue').where('iri', '=', iri).execute();
  }

  async processAndSave(item: QueueItem) {
    await this.remove(item.iri);
    await this.registry.save({iri: item.iri, type: item.type});
  }

  async processAndRemove(item: QueueItem) {
    await this.remove(item.iri);
    await this.registry.remove(item.iri);
  }

  async retry(item: QueueItem) {
    await this.remove(item.iri);

    const newRetryCount = item.retry_count + 1;
    if (newRetryCount > this.maxRetryCount) {
      throw new Error(
        `Cannot retry "${item.iri}": max retry count of ${this.maxRetryCount} reached`
      );
    }

    const newItem: NewQueueItem = {
      iri: item.iri,
      action: item.action,
      type: item.type,
      retry_count: newRetryCount,
    };
    return this.push(newItem);
  }

  async getAll(options?: GetAllOptions) {
    const opts = getAllOptionsSchema.parse(options);

    let query = this.db
      .selectFrom('queue')
      .orderBy('created_at asc') // FIFO
      .selectAll();

    if (opts.type !== undefined) {
      query = query.where('type', '=', opts.type);
    }

    if (opts.limit !== undefined) {
      query = query.limit(opts.limit);
    }

    return query.execute();
  }

  async size(options?: SizeOptions) {
    const opts = sizeOptionsSchema.parse(options);

    let query = this.db
      .selectFrom('queue')
      .select(eb => eb.fn.count<number>('iri').as('count'));

    if (opts.type !== undefined) {
      query = query.where('type', '=', opts.type);
    }

    const result = await query.executeTakeFirstOrThrow();

    return result.count;
  }
}

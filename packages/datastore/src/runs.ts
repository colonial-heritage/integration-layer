import {Connection} from './connection.js';
import {Database, NewRunItem} from './types.js';
import {Kysely} from 'kysely';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  connection: z.instanceof(Connection),
});

export type RunsConstructorOptions = z.input<typeof constructorOptionsSchema>;

export class Runs {
  private db: Kysely<Database>;

  constructor(options: RunsConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.db = opts.connection.db;
  }

  async removeAll() {
    await this.db.deleteFrom('runs').execute();
  }

  async save(item?: NewRunItem) {
    await this.removeAll(); // Remove previous runs, if any

    return this.db
      .insertInto('runs')
      .values(item || {identifier: ''})
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async getLast() {
    return this.db.selectFrom('runs').selectAll().executeTakeFirst();
  }
}

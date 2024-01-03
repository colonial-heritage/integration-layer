import {ESMFileMigrationProvider} from './provider.js';
import {Database} from './types.js';
import SQLite from 'better-sqlite3';
import {Migrator, Kysely, SqliteDialect} from 'kysely';
import {mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  path: z.string(),
});

export type ConnectionConstructorOptions = z.input<
  typeof constructorOptionsSchema
>;

export class Connection {
  readonly db: Kysely<Database>;

  constructor(options: ConnectionConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    const dialect = new SqliteDialect({
      database: async () => {
        // Make sure the directory of the file exists - SQLite will not create it
        await mkdir(dirname(opts.path), {recursive: true});

        const db = new SQLite(opts.path);
        db.pragma('journal_mode = WAL');
        return db;
      },
    });

    this.db = new Kysely<Database>({dialect});
  }

  private async runMigrations() {
    const provider = new ESMFileMigrationProvider('./migrations');
    const migrator = new Migrator({db: this.db, provider});
    const {error} = await migrator.migrateToLatest();

    if (error) {
      throw error;
    }
  }

  static async new(options: ConnectionConstructorOptions) {
    const connection = new Connection(options);
    await connection.runMigrations();

    return connection;
  }
}

import {MigrationProvider, Migration} from 'kysely';
import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {URL, fileURLToPath} from 'node:url';

// Problem: when unit testing this package, Kysely cannot load the *.ts migrations,
// throwing TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts".
// This alternate migration provider loads the equivalent *.js migrations instead.
// Based on https://github.com/kysely-org/kysely/issues/277#issuecomment-1385995789

export class ESMFileMigrationProvider implements MigrationProvider {
  constructor(private relativePath: string) {}

  async getMigrations() {
    const migrations: Record<string, Migration> = {};
    const dirname = fileURLToPath(new URL('.', import.meta.url));
    const resolvedPath = resolve(dirname, this.relativePath);
    const files = await readdir(resolvedPath);

    for (const file of files) {
      if (!file.endsWith('.js')) {
        continue;
      }

      const migration = await import(this.relativePath + '/' + file);
      const migrationKey = file.substring(0, file.lastIndexOf('.'));
      migrations[migrationKey] = migration;
    }

    return migrations;
  }
}

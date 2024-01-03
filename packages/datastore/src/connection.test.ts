import {Connection} from './connection.js';
import {Kysely} from 'kysely';
import {join} from 'node:path';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

const tmpDir = './tmp';
const dataFile = join(tmpDir, 'connection.sqlite');

beforeEach(async () => {
  await rimraf(tmpDir);
});

describe('new', () => {
  it('returns a new instance', async () => {
    const connection = await Connection.new({path: dataFile});

    expect(connection).toBeInstanceOf(Connection);
    expect(connection.db).toBeInstanceOf(Kysely);
  });

  it('runs migrations', async () => {
    const connection = await Connection.new({path: dataFile});
    const db = connection.db;

    // Simple check for table existence
    const tables = ['queue', 'registry'];
    for (const table of tables) {
      const items = await db
        // @ts-expect-error:TS2769
        .selectFrom(table)
        .selectAll()
        .execute();

      expect(items).toStrictEqual([]);
    }
  });
});

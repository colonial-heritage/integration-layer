import {Connection} from './connection.js';
import {Runs} from './runs.js';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';

const tmpDir = './tmp/runs';
const dataFile = join(tmpDir, 'data.sqlite');
let connection: Connection;

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  connection = await Connection.new({path: dataFile});
});

describe('new', () => {
  it('returns a new instance', () => {
    const runs = new Runs({connection});

    expect(runs).toBeInstanceOf(Runs);
  });
});

describe('removeAll', () => {
  it('removes all runs', async () => {
    const runs = new Runs({connection});

    await runs.save();
    await runs.removeAll();

    const allRuns = await connection.db
      .selectFrom('runs')
      .selectAll()
      .execute();

    expect(allRuns.length).toBe(0);
  });
});

describe('save', () => {
  it('saves a run', async () => {
    const runs = new Runs({connection});

    const run = await runs.save();

    const allRuns = await connection.db
      .selectFrom('runs')
      .selectAll()
      .execute();

    expect(allRuns.length).toBe(1);
    expect(allRuns[0].id).toEqual(run.id);
  });

  it('saves a run with additional information', async () => {
    const runs = new Runs({connection});

    const run = await runs.save({
      identifier: 'testId',
      created_at: '2024-01-01',
    });

    const allRuns = await connection.db
      .selectFrom('runs')
      .selectAll()
      .execute();

    expect(allRuns.length).toBe(1);
    expect(allRuns[0]).toMatchObject({
      id: run.id,
      identifier: 'testId',
      created_at: '2024-01-01',
    });
  });

  it('saves a run, removing existing runs', async () => {
    const runs = new Runs({connection});

    await runs.save();
    const run2 = await runs.save();

    const allRuns = await connection.db
      .selectFrom('runs')
      .selectAll()
      .execute();

    expect(allRuns.length).toBe(1);
    expect(allRuns[0].id).toEqual(run2.id);
  });
});

describe('getLast', () => {
  it('gets the last run', async () => {
    const runs = new Runs({connection});

    const run = await runs.save();
    const lastRun = await runs.getLast();

    expect(lastRun!.id).toEqual(run.id);
  });
});

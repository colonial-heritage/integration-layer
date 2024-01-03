import {Connection} from './connection.js';
import {Runs} from './runs.js';
import {join} from 'node:path';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

const tmpDir = './tmp';
const dataFile = join(tmpDir, 'runs.sqlite');
let connection: Connection;

beforeEach(async () => {
  await rimraf(tmpDir);
  connection = await Connection.new({path: dataFile});
});

describe('new', () => {
  it('returns a new instance', async () => {
    const runs = new Runs({connection});

    expect(runs).toBeInstanceOf(Runs);
  });
});

describe('save', async () => {
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

describe('getLast', async () => {
  it('gets the last run', async () => {
    const runs = new Runs({connection});

    const run = await runs.save();
    const lastRun = await runs.getLast();

    expect(lastRun!.id).toEqual(run.id);
  });
});

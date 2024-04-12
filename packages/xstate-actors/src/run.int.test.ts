import {
  GetLastRunInput,
  RegisterRunAndCheckIfRunMustContinueInput,
  RegisterRunInput,
  getLastRun,
  registerRun,
  registerRunAndCheckIfRunMustContinue,
} from './run.js';
import {Connection, Runs} from '@colonial-collections/datastore';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pino} from 'pino';
import {beforeEach, describe, expect, it} from 'vitest';
import {createActor, toPromise} from 'xstate';

const tmpDir = './tmp';
const dataFile = join(tmpDir, 'data.sqlite');
const logger = pino();
let connection: Connection;

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  connection = await Connection.new({path: dataFile});
});

describe('getLastRun', () => {
  it('returns undefined if there is no last run', async () => {
    const runs = new Runs({connection});

    const input: GetLastRunInput = {logger, runs};

    const lastRun = await toPromise(createActor(getLastRun, {input}).start());

    expect(lastRun).toBeUndefined();
  });

  it('returns the last run', async () => {
    const runs = new Runs({connection});
    await runs.save({identifier: 'randomId'});

    const input: GetLastRunInput = {logger, runs};

    const lastRun = await toPromise(createActor(getLastRun, {input}).start());

    expect(lastRun).toMatchObject({
      id: 1,
      identifier: 'randomId',
    });
  });
});

describe('registerRun', () => {
  it('returns true if the run has been registered', async () => {
    const runs = new Runs({connection});

    const input: RegisterRunInput = {logger, runs};

    const continueRun = await toPromise(
      createActor(registerRun, {input}).start()
    );

    expect(continueRun).toBe(true);
  });
});

describe('registerRunAndCheckIfRunMustContinue', () => {
  it('returns true if the run must continue because there is no last run', async () => {
    const runs = new Runs({connection});

    const input: RegisterRunAndCheckIfRunMustContinueInput = {
      logger,
      runs,
      endpointUrl: 'https://dbpedia.org/sparql',
      queryFile: './fixtures/queries/check-must-continue-run-dbpedia.rq',
    };

    const continueRun = await toPromise(
      createActor(registerRunAndCheckIfRunMustContinue, {input}).start()
    );

    expect(continueRun).toBe(true);
  });

  it('returns false if the run must not continue because the resource is not changed since the last run', async () => {
    const runs = new Runs({connection});
    await runs.save({identifier: (1125038679 + 100000).toString()}); // Non-existing revision ID. Changes if the source data changes

    const input: RegisterRunAndCheckIfRunMustContinueInput = {
      logger,
      runs,
      endpointUrl: 'https://dbpedia.org/sparql',
      queryFile: './fixtures/queries/check-must-continue-run-dbpedia.rq',
    };

    const continueRun = await toPromise(
      createActor(registerRunAndCheckIfRunMustContinue, {input}).start()
    );

    expect(continueRun).toBe(false);
  });

  it('returns true if the run must continue because the resource is changed since the last run', async () => {
    const runs = new Runs({connection});
    await runs.save({identifier: '1124717623'}); // Old revision ID

    const input: RegisterRunAndCheckIfRunMustContinueInput = {
      logger,
      runs,
      endpointUrl: 'https://dbpedia.org/sparql',
      queryFile: './fixtures/queries/check-must-continue-run-dbpedia.rq',
    };

    const continueRun = await toPromise(
      createActor(registerRunAndCheckIfRunMustContinue, {input}).start()
    );

    expect(continueRun).toBe(true);
  });
});

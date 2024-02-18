import {run} from './run.js';
import {Connection, Queue, Runs} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

let connection: Connection;
const tmpDir = './tmp/integration';
const resourceDir = join(tmpDir, 'resources');
const dataFile = join(tmpDir, 'data.sqlite');

beforeEach(async () => {
  await rimraf(tmpDir);
  await mkdir(tmpDir, {recursive: true});
  connection = await Connection.new({path: dataFile});
});

describe('run', () => {
  // Time-consuming test
  it('registers run and collects IRIs of resources if queue is empty (states 1, 2, 3, 4, 5, 6, 7, 9)', async () => {
    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl:
        'https://iiif.bodleian.ox.ac.uk/iiif/activity/all-changes',
      dereferenceBatchSize: 10,
    });

    const queue = new Queue({connection});
    const items = await queue.getAll();
    const iris = items.map(item => item.iri);

    // Changes if the source data changes
    expect(iris.length).toBeGreaterThanOrEqual(20441);
  });

  it('registers run and collects IRIs of resources changed since the last run if queue is empty (states 1, 2, 3, 4, 5, 6, 7, 9)', async () => {
    const runs = new Runs({connection});
    await runs.save({created_at: '2024-01-01'});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl:
        'https://iiif.bodleian.ox.ac.uk/iiif/activity/all-changes',
      dereferenceBatchSize: 10,
    });

    const queue = new Queue({connection});
    const items = await queue.getAll();
    const iris = items.map(item => item.iri);

    // Changes if the source data changes
    expect(iris.length).toBeGreaterThanOrEqual(23);
  });

  it('registers run and does not collect IRIs of resources because no resources have been changed since the last run (states 1, 2, 3, 4, 5, 6, 7, 9)', async () => {
    const runs = new Runs({connection});
    await runs.save(); // Last run = now

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl:
        'https://iiif.bodleian.ox.ac.uk/iiif/activity/all-changes',
      dereferenceBatchSize: 10,
    });

    const queue = new Queue({connection});

    expect(await queue.size()).toBe(0);
  });
});

describe('run', () => {
  it('dereferences a resource if queue contains a resource (states 1, 2, 8, 9)', async () => {
    const iri1 =
      'https://iiif.bodleian.ox.ac.uk/iiif/manifest/cc6f7f04-7236-40e2-8327-520158dfc7d5.json';
    const iri2 =
      'https://iiif.bodleian.ox.ac.uk/iiif/manifest/4c7601f1-a776-4012-9244-a6d9e60b683f.json';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: '', // Unused by the test
      dereferenceBatchSize: 1,
    });

    const filestore = new Filestore({dir: resourceDir});
    const pathOfIri = filestore.createPathFromIri(iri1);

    expect(existsSync(pathOfIri)).toBe(true);
    expect(await queue.size()).toBe(1);
  });
});

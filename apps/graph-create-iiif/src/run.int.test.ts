import {run} from './run.js';
import {Connection, Queue, Runs} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {existsSync} from 'node:fs';
import {mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {env} from 'node:process';
import {beforeEach, describe, expect, it} from 'vitest';

let connection: Connection;
const tmpDir = './tmp/integration';
const resourceDir = join(tmpDir, 'resources');
const dataFile = join(tmpDir, 'data.sqlite');
const triplydbInstanceUrl = env.TRIPLYDB_INSTANCE_URL as string;
const triplydbApiToken = env.TRIPLYDB_API_TOKEN as string;
const triplydbAccount = env.TRIPLYDB_ACCOUNT_DEVELOPMENT as string;
const triplydbDataset = env.TRIPLYDB_DATASET_KG_DEVELOPMENT as string;
const triplydbService = 'kg';
const graphName = 'https://example.org/graph-create-iiif-integration';

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
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
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
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
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
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
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    expect(await queue.size()).toBe(0);
  });
});

describe('run', () => {
  it('dereferences a resource if queue contains a resource and does not sync to data platform because queue is not empty (states 1, 2, 8a, 8b, 8c, 9)', async () => {
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
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const filestore = new Filestore({dir: resourceDir});
    const pathOfIri = filestore.createPathFromId(iri1);

    expect(existsSync(pathOfIri)).toBe(true);
    expect(await queue.size()).toBe(1);
  });

  it('dereferences a resource if queue contains a resource and syncs to data platform because queue is empty (states 1, 2, 8a, 8b, 8c, 8d, 9)', async () => {
    const iri =
      'https://iiif.bodleian.ox.ac.uk/iiif/manifest/cc6f7f04-7236-40e2-8327-520158dfc7d5.json';

    const queue = new Queue({connection});
    await queue.push({iri});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: '', // Unused by the test
      dereferenceBatchSize: 1,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });
  });
});

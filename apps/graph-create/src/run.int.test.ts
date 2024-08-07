import {run} from './run.js';
import {
  Connection,
  Queue,
  Registry,
  Runs,
} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {existsSync} from 'node:fs';
import {cp, mkdir, rm} from 'node:fs/promises';
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
const graphName = 'https://example.org/graph-create-integration';

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  await mkdir(tmpDir, {recursive: true});
  connection = await Connection.new({path: dataFile});
});

describe('run', () => {
  it('registers run, collects IRIs, generates all resources and syncs to data platform because batch size is not set (states 1a, 1b, 3, 4a, 4b, 4c, 4d, 5a, 5b, 5c, 5d, 6)', async () => {
    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateQueryFile: './fixtures/queries/iterate-jack-dowding.rq',
      generateEndpointUrl: 'https://dbpedia.org/sparql',
      generateQueryFile: './fixtures/queries/generate-dbpedia.rq',
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    expect(await queue.size()).toBe(0);

    // Changes if the source data changes
    const sampleIri = 'http://dbpedia.org/resource/Jack_Dowding_(footballer)';

    // New resource about 'John Dowding' should have been created
    const filestore = new Filestore({dir: resourceDir});
    const pathOfSampleIri = filestore.createPathFromId(sampleIri);

    expect(existsSync(pathOfSampleIri)).toBe(true);
  });

  it('registers run, collects IRIs, generates all resources and syncs to data platform because batch size >= queue size (states 1a, 1b, 3, 4a, 4b, 4c, 4d, 5a, 5b, 5c, 5d, 6)', async () => {
    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateQueryFile: './fixtures/queries/iterate-jack-dowding.rq',
      generateEndpointUrl: 'https://dbpedia.org/sparql',
      generateQueryFile: './fixtures/queries/generate-dbpedia.rq',
      generateBatchSize: 1,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    expect(await queue.size()).toBe(0);

    // Changes if the source data changes
    const sampleIri = 'http://dbpedia.org/resource/Jack_Dowding_(footballer)';

    // New resource about 'John Dowding' should have been created
    const filestore = new Filestore({dir: resourceDir});
    const pathOfSampleIri = filestore.createPathFromId(sampleIri);

    expect(existsSync(pathOfSampleIri)).toBe(true);
  });
});

describe('run', () => {
  it('registers run and collects IRIs if queue is empty (states 1a, 1b, 3, 4a, 4b, 4c, 4d, 6)', async () => {
    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateQueryFile: './fixtures/queries/iterate-john-mccallum.rq',
      generateEndpointUrl: 'https://dbpedia.org/sparql',
      generateQueryFile: './fixtures/queries/generate-dbpedia.rq',
      generateBatchSize: 3,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    // Changes if the source data changes
    expect(await queue.size()).toBe(5); // Remaining items
  });

  it('registers run and removes all resources if queue is empty (states 1a, 1b, 3, 4a, 4b, 4c, 4d, 6)', async () => {
    // Copy obsolete resources
    await cp('./fixtures/dbpedia', resourceDir, {recursive: true});

    const obsoleteIri =
      'http://dbpedia.org/resource/John_McCallum_(Australian_politician)';

    const registry = new Registry({connection});
    await registry.save({iri: obsoleteIri});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateQueryFile: './fixtures/queries/iterate-jack-dowding.rq',
      generateEndpointUrl: 'https://dbpedia.org/sparql',
      generateQueryFile: './fixtures/queries/generate-dbpedia.rq',
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    // Changes if the source data changes
    expect(await queue.size()).toBe(0); // Remaining items

    // Obsolete resource about 'John McCallum' should have been removed
    const filestore = new Filestore({dir: resourceDir});
    const pathOfObsoleteIri = filestore.createPathFromId(obsoleteIri);

    expect(existsSync(pathOfObsoleteIri)).toBe(false);
  });
});

describe('run', () => {
  it('registers run and does not continue if it must not (states 1a, 1b, 2a, 2b, 6)', async () => {
    const runs = new Runs({connection});
    await runs.save({identifier: (1125038679 + 100000).toString()}); // Non-existing revision ID. Changes if the source data changes

    await run({
      resourceDir,
      dataFile,
      checkEndpointUrl: 'https://dbpedia.org/sparql',
      checkIfRunMustContinueQueryFile:
        './fixtures/queries/check-must-continue-run-dbpedia.rq',
      iterateEndpointUrl: '', // Unused by the test
      iterateQueryFile: '', // Unused by the test
      generateEndpointUrl: '', // Unused by the test
      generateQueryFile: '', // Unused by the test
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });
  });

  it('registers run and continues if it must (states 1a, 1b, 2a, 2b, 4a, 4b, 4c, 4d, 6)', async () => {
    await run({
      resourceDir,
      dataFile,
      checkEndpointUrl: 'https://dbpedia.org/sparql',
      checkIfRunMustContinueQueryFile:
        './fixtures/queries/check-must-continue-run-dbpedia.rq',
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateQueryFile: './fixtures/queries/iterate-john-mccallum.rq',
      generateEndpointUrl: 'https://dbpedia.org/sparql',
      generateQueryFile: './fixtures/queries/generate-dbpedia.rq',
      generateBatchSize: 3,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    // Changes if the source data changes
    expect(await queue.size()).toBe(5); // Remaining items
  });
});

describe('run', () => {
  it('generates a resource if queue contains a resource and does not sync to data platform because queue is not empty (states 1a, 1b, 5a, 5b, 5c, 6)', async () => {
    const iri1 = 'http://vocab.getty.edu/aat/300111999';
    const iri2 = 'http://vocab.getty.edu/aat/300027200';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: '', // Unused by the test
      iterateQueryFile: '', // Unused by the test
      generateEndpointUrl: 'https://vocab.getty.edu/sparql',
      generateQueryFile: './fixtures/queries/generate-aat.rq',
      generateBatchSize: 1,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    expect(await queue.size()).toBe(1); // Remaining items
  });

  it('generates a resource if queue contains a resource and syncs to data platform because queue is now empty (states 1a, 1b, 5a, 5b, 5c, 5d, 6)', async () => {
    const iri = 'http://vocab.getty.edu/aat/300111999';

    const queue = new Queue({connection});
    await queue.push({iri});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: '', // Unused by the test
      iterateQueryFile: '', // Unused by the test
      generateEndpointUrl: 'https://vocab.getty.edu/sparql',
      generateQueryFile: './fixtures/queries/generate-aat.rq',
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    expect(await queue.size()).toBe(0); // Remaining items
  });
});

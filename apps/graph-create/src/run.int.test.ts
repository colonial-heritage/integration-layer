import {run} from './run.js';
import {
  Connection,
  Queue,
  Registry,
  Runs,
} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {existsSync} from 'node:fs';
import {cp, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {env} from 'node:process';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

let connection: Connection;
const tmpDir = './tmp/integration';
const resourceDir = join(tmpDir, 'resources');
const dataFile = join(tmpDir, 'data.sqlite');
const triplydbInstanceUrl = env.TRIPLYDB_INSTANCE_URL as string;
const triplydbApiToken = env.TRIPLYDB_API_TOKEN as string;
const triplydbAccount = env.TRIPLYDB_ACCOUNT_DEVELOPMENT as string;
const triplydbDataset = env.TRIPLYDB_DATASET_KG_DEVELOPMENT as string;
const triplydbServiceName = 'kg';
const triplydbServiceType = 'virtuoso';
const graphName = 'https://example.org/graph-create-integration';

beforeEach(async () => {
  await rimraf(tmpDir);
  await mkdir(tmpDir, {recursive: true});
  connection = await Connection.new({path: dataFile});
});

describe('run', () => {
  it('registers run and collects IRIs of resources if queue is empty (states 1a, 1b, 3, 4a, 4b, 6)', async () => {
    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateQueryFile: './fixtures/queries/iterate-john-mccallum.rq',
      generateEndpointUrl: '', // Unused by the test
      generateQueryFile: '', // Unused by the test
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbServiceName,
      triplydbServiceType,
      graphName,
    });

    const queue = new Queue({connection});
    const items = await queue.getAll();
    const iris = items.map(item => item.iri);

    // Changes if the source data changes
    expect(iris).toEqual(
      expect.arrayContaining([
        'http://dbpedia.org/resource/John_McCallum_(sports_writer)',
        'http://dbpedia.org/resource/Jack_Dowding_(footballer)',
        'http://dbpedia.org/resource/John_McCallum',
        'http://dbpedia.org/resource/John_McCallum_(Australian_politician)',
        'http://dbpedia.org/resource/John_McCallum_(actor)',
      ])
    );
  });

  it('registers run and removes obsolete resources if queue is empty (states 1a, 1b, 3, 4a, 4b, 6)', async () => {
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
      generateEndpointUrl: '', // Unused by the test
      generateQueryFile: '', // Unused by the test
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbServiceName,
      triplydbServiceType,
      graphName,
    });

    const queue = new Queue({connection});
    const items = await queue.getAll();
    const iris = items.map(item => item.iri);

    // Changes if the source data changes
    expect(iris).toEqual([
      'http://dbpedia.org/resource/Jack_Dowding_(footballer)',
    ]);

    // Obsolete resource about 'John McCallum' should have been removed
    const filestore = new Filestore({dir: resourceDir});
    const pathOfObsoleteIri = filestore.createPathFromIri(obsoleteIri);

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
      triplydbServiceName,
      triplydbServiceType,
      graphName,
    });
  });

  it('registers run and continues if it must (states 1a, 1b, 2a, 2b, 4a, 4b, 6)', async () => {
    await run({
      resourceDir,
      dataFile,
      checkEndpointUrl: 'https://dbpedia.org/sparql',
      checkIfRunMustContinueQueryFile:
        './fixtures/queries/check-must-continue-run-dbpedia.rq',
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateQueryFile: './fixtures/queries/iterate-john-mccallum.rq',
      generateEndpointUrl: '', // Unused by the test
      generateQueryFile: '', // Unused by the test
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbServiceName,
      triplydbServiceType,
      graphName,
    });

    const queue = new Queue({connection});
    const items = await queue.getAll();
    const iris = items.map(item => item.iri);

    // Changes if the source data changes
    expect(iris).toEqual(
      expect.arrayContaining([
        'http://dbpedia.org/resource/John_McCallum_(sports_writer)',
        'http://dbpedia.org/resource/Jack_Dowding_(footballer)',
        'http://dbpedia.org/resource/John_McCallum',
        'http://dbpedia.org/resource/John_McCallum_(Australian_politician)',
        'http://dbpedia.org/resource/John_McCallum_(actor)',
      ])
    );
  });
});

describe('run', () => {
  it('generates a resource if queue contains a resource (states 1a, 1b, 5a, 5b, 5c, 6)', async () => {
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
      triplydbServiceName,
      triplydbServiceType,
      graphName,
    });
  });

  it('generates a resource if queue contains a resource and uploads to data platform because queue is now empty (states 1a, 1b, 5a, 5b, 5c, 5d, 6)', async () => {
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
      triplydbServiceName,
      triplydbServiceType,
      graphName,
    });
  });
});

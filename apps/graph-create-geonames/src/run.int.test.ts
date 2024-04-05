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
const locationsDir = join(resourceDir, 'locations');
const countriesDir = join(resourceDir, 'countries');
const dataFile = join(tmpDir, 'data.sqlite');
const triplydbInstanceUrl = env.TRIPLYDB_INSTANCE_URL as string;
const triplydbApiToken = env.TRIPLYDB_API_TOKEN as string;
const triplydbAccount = env.TRIPLYDB_ACCOUNT_DEVELOPMENT as string;
const triplydbDataset = env.TRIPLYDB_DATASET_KG_DEVELOPMENT as string;
const triplydbService = 'kg';
const graphName = 'https://example.org/graph-create-geonames-integration';

beforeEach(async () => {
  await rimraf(tmpDir);
  await mkdir(tmpDir, {recursive: true});
  connection = await Connection.new({path: dataFile});
});

describe('run', () => {
  it('registers run and collects IRIs of locations if queue is empty (states 1a, 1b, 1c, 3, 4a, 4b, 4c, 4d, 8)', async () => {
    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: './fixtures/queries/iterate-locations.rq',
      iterateCountriesQueryFile: '', // Unused by the test
      dereferenceBatchSize: 10,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    // Changes if the source data changes
    expect(await queue.size({type: 'locations'})).toBe(21); // Remaining items
  });

  it('registers run and removes obsolete resources if queue is empty (states 1a, 1b, 1c, 3, 4a, 4b, 4c, 4d, 8)', async () => {
    // Copy obsolete locations
    await cp('./fixtures/geonames/locations', locationsDir, {recursive: true});

    const obsoleteIri = 'https://sws.geonames.org/5024159/';

    const registry = new Registry({connection});
    await registry.save({iri: obsoleteIri, type: 'locations'});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: './fixtures/queries/iterate-locations.rq',
      iterateCountriesQueryFile: '', // Unused by the test
      dereferenceBatchSize: 10,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    // Changes if the source data changes
    expect(await queue.size({type: 'locations'})).toBe(21); // Remaining items

    // Obsolete resource about 'Delft' should have been deleted
    const filestore = new Filestore({dir: locationsDir});
    const pathOfObsoleteIri = filestore.createPathFromId(obsoleteIri);

    expect(existsSync(pathOfObsoleteIri)).toBe(false);
  });
});

describe('run', () => {
  it('registers run and does not continue if it must not (states 1a, 1b, 1c, 2a, 2b, 8)', async () => {
    const runs = new Runs({connection});
    await runs.save({identifier: (1125038679 + 100000).toString()}); // Non-existing revision ID. Changes if the source data changes

    await run({
      resourceDir,
      dataFile,
      checkEndpointUrl: 'https://dbpedia.org/sparql',
      checkIfRunMustContinueQueryFile:
        './fixtures/queries/check-must-continue-run-dbpedia.rq',
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: './fixtures/queries/iterate-locations.rq',
      iterateCountriesQueryFile: '', // Unused by the test
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });
  });

  it('registers run and continues if it must (states 1a, 1b, 1c, 2a, 2b, 4a, 4b, 4c, 4d, 8)', async () => {
    await run({
      resourceDir,
      dataFile,
      checkEndpointUrl: 'https://dbpedia.org/sparql',
      checkIfRunMustContinueQueryFile:
        './fixtures/queries/check-must-continue-run-dbpedia.rq',
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: './fixtures/queries/iterate-locations.rq',
      iterateCountriesQueryFile: '', // Unused by the test
      dereferenceBatchSize: 10,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const queue = new Queue({connection});

    // Changes if the source data changes
    expect(await queue.size({type: 'locations'})).toBe(21); // Remaining items
  });
});

describe('run', () => {
  it('dereferences a location if queue contains a location (states 1a, 1b, 1c, 3, 5a, 5b, 5c, 8)', async () => {
    const iri1 = 'https://sws.geonames.org/2759794/';
    const iri2 = 'https://sws.geonames.org/5323799/';

    const queue = new Queue({connection});
    await queue.push({iri: iri1, type: 'locations'});
    await queue.push({iri: iri2, type: 'locations'});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: '', // Unused by the test
      iterateCountriesQueryFile: './fixtures/queries/iterate-countries.rq',
      dereferenceBatchSize: 1,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const filestore = new Filestore({dir: locationsDir});
    const pathOfIri = filestore.createPathFromId(iri1);

    expect(existsSync(pathOfIri)).toBe(true);
    expect(await queue.size()).toBe(1);
  });
});

describe('run', () => {
  it('collects IRIs of countries if queue does not contain locations (states 1a, 1b, 1c, 3, 5a, 5b, 5c, 6a, 6b, 6c, 6d, 8)', async () => {
    const iri = 'https://sws.geonames.org/2759794/';

    const queue = new Queue({connection});
    await queue.push({iri, type: 'locations'});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: '', // Unused by the test
      iterateCountriesQueryFile: './fixtures/queries/iterate-countries.rq',
      dereferenceBatchSize: 1,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    // Changes if the source data changes
    expect(await queue.size({type: 'countries'})).toBe(0); // Remaining items
  });

  it('removes obsolete countries if queue does not contain locations (states 1a, 1b, 1c, 3, 5a, 5b, 5c, 6a, 6b, 6c, 6d, 8)', async () => {
    // Copy obsolete countries
    await cp('./fixtures/geonames/countries', countriesDir, {recursive: true});

    const obsoleteIri = 'https://sws.geonames.org/2921044/';

    const registry = new Registry({connection});
    await registry.save({iri: obsoleteIri, type: 'countries'});

    const iri = 'https://sws.geonames.org/2759794/';

    const queue = new Queue({connection});
    await queue.push({iri, type: 'locations'});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: '', // Unused by the test
      iterateCountriesQueryFile: './fixtures/queries/iterate-countries.rq',
      dereferenceBatchSize: 1,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    // Changes if the source data changes
    expect(await queue.size({type: 'countries'})).toBe(0); // Remaining items

    // Obsolete resource about 'Germany' should have been removed
    const filestore = new Filestore({dir: countriesDir});
    const pathOfObsoleteIri = filestore.createPathFromId(obsoleteIri);

    expect(existsSync(pathOfObsoleteIri)).toBe(false);
  });
});

describe('run', () => {
  it('dereferences a country if queue contains a country and does not sync to data platform because queue is not empty (states 1a, 1b, 1c, 7a, 7b, 7c, 8)', async () => {
    const iri1 = 'https://sws.geonames.org/953987/';
    const iri2 = 'https://sws.geonames.org/6252001/';

    const queue = new Queue({connection});
    await queue.push({iri: iri1, type: 'countries'});
    await queue.push({iri: iri2, type: 'countries'});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: '', // Unused by the test
      iterateCountriesQueryFile: './fixtures/queries/iterate-countries.rq',
      dereferenceBatchSize: 1,
      triplydbInstanceUrl,
      triplydbApiToken,
      triplydbAccount,
      triplydbDataset,
      triplydbService,
      graphName,
    });

    const filestore = new Filestore({dir: countriesDir});
    const pathOfIri = filestore.createPathFromId(iri1);

    expect(existsSync(pathOfIri)).toBe(true);
    expect(await queue.size()).toBe(1);
  });

  it('dereferences a country if queue contains a country and syncs to data platform because queue does not contain countries anymore (states 1a, 1b, 1c, 7a, 7b, 7c, 7d, 8)', async () => {
    const iri = 'https://sws.geonames.org/953987/';

    const queue = new Queue({connection});
    await queue.push({iri, type: 'countries'});

    await run({
      resourceDir,
      dataFile,
      iterateEndpointUrl: 'https://dbpedia.org/sparql',
      iterateLocationsQueryFile: '', // Unused by the test
      iterateCountriesQueryFile: './fixtures/queries/iterate-countries.rq',
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

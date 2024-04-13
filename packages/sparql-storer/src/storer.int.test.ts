import {SparqlStorer} from './storer.js';
import {Connection, Queue} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {existsSync} from 'node:fs';
import {mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pino} from 'pino';
import {beforeEach, describe, expect, it} from 'vitest';

let connection: Connection;
const tmpDir = './tmp';
const resourceDir = join(tmpDir, 'resources');
const dataFile = join(tmpDir, 'data.sqlite');
const filestore = new Filestore({dir: resourceDir});
const query = `
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  CONSTRUCT {
    ?this a skos:Concept ;
      skos:prefLabel ?prefLabel ;
      skos:altLabel ?altLabel .
  }
  WHERE {
    VALUES ?this {
      ?_iris
    }
    ?this a skos:Concept ;
      skos:prefLabel ?prefLabel .
    OPTIONAL { ?this skos:altLabel ?altlabel }
  }
`;

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  await mkdir(tmpDir, {recursive: true});
  connection = await Connection.new({path: dataFile});
});

describe('run', () => {
  it('stores every item in the queue in a separate file if "numberOfResourcesPerRequest" = 1', async () => {
    expect.assertions(6);

    const iri1 = 'http://vocab.getty.edu/aat/300111999';
    const iri2 = 'http://vocab.getty.edu/aat/300027200';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});

    const storer = new SparqlStorer({
      logger: pino(),
      resourceDir,
      endpointUrl: 'https://vocab.getty.edu/sparql',
      query,
    });

    let numberOfEmits = 0;
    storer.on('processed-resource', (totalNumberOfResources: number) => {
      expect(totalNumberOfResources).toBe(2);
      numberOfEmits++;
    });

    await storer.run({queue, numberOfResourcesPerRequest: 1});

    expect(numberOfEmits).toBe(2);
    const queueSize = await queue.size();
    expect(queueSize).toBe(0);

    const pathOfIri1 = filestore.createPathFromId(iri1);
    const pathOfIri2 = filestore.createPathFromId(iri2);

    expect(existsSync(pathOfIri1)).toBe(true);
    expect(existsSync(pathOfIri2)).toBe(true);
  });

  it('stores multiple items in the queue in the same file if "numberOfResourcesPerRequest" > 1', async () => {
    expect.assertions(4);

    const iri1 = 'http://vocab.getty.edu/aat/300111999';
    const iri2 = 'http://vocab.getty.edu/aat/300027200';
    const iri3 = 'http://vocab.getty.edu/aat/300026650';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});
    await queue.push({iri: iri3});

    const storer = new SparqlStorer({
      logger: pino(),
      resourceDir,
      endpointUrl: 'https://vocab.getty.edu/sparql',
      query,
    });

    let numberOfEmits = 0;
    storer.on('processed-resource', () => numberOfEmits++);

    await storer.run({queue, numberOfResourcesPerRequest: 2});

    expect(numberOfEmits).toBe(2);
    const queueSize = await queue.size();
    expect(queueSize).toBe(0);

    const idOfFirstChunk = [iri1, iri2].join();
    const pathOfIdOfFirstChunk = filestore.createPathFromId(idOfFirstChunk);
    expect(existsSync(pathOfIdOfFirstChunk)).toBe(true);

    const idOfSecondChunk = [iri3].join();
    const pathOfIdOfSecondChunk = filestore.createPathFromId(idOfSecondChunk);
    expect(existsSync(pathOfIdOfSecondChunk)).toBe(true);
  });

  it('stores the selected number of items in the queue as files', async () => {
    expect.assertions(5);

    const iri1 = 'http://vocab.getty.edu/aat/300111999';
    const iri2 = 'http://vocab.getty.edu/aat/300027200';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});

    const storer = new SparqlStorer({
      logger: pino(),
      resourceDir,
      endpointUrl: 'https://vocab.getty.edu/sparql',
      query,
    });

    let numberOfEmits = 0;
    storer.on('processed-resource', (totalNumberOfResources: number) => {
      expect(totalNumberOfResources).toBe(1);
      numberOfEmits++;
    });

    await storer.run({queue, batchSize: 1});

    expect(numberOfEmits).toBe(1);
    const queueSize = await queue.size();
    expect(queueSize).toBe(1);

    const pathOfIri1 = filestore.createPathFromId(iri1);
    const pathOfIri2 = filestore.createPathFromId(iri2);

    expect(existsSync(pathOfIri1)).toBe(true);
    expect(existsSync(pathOfIri2)).toBe(false);
  });

  it('stores the selected number of items in the queue as files, changing the batch size between runs', async () => {
    const iri1 = 'http://vocab.getty.edu/aat/300111999';
    const iri2 = 'http://vocab.getty.edu/aat/300027200';
    const iri3 = 'http://vocab.getty.edu/aat/300266639';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});
    await queue.push({iri: iri3});

    const storer = new SparqlStorer({
      logger: pino(),
      resourceDir,
      endpointUrl: 'https://vocab.getty.edu/sparql',
      query,
    });

    await storer.run({queue, batchSize: 1});

    const pathOfIri1 = filestore.createPathFromId(iri1);
    const pathOfIri2 = filestore.createPathFromId(iri2);
    const pathOfIri3 = filestore.createPathFromId(iri3);

    expect(existsSync(pathOfIri1)).toBe(true);
    expect(existsSync(pathOfIri2)).toBe(false);
    expect(existsSync(pathOfIri3)).toBe(false);

    await storer.run({queue, batchSize: 2});

    expect(existsSync(pathOfIri2)).toBe(true);
    expect(existsSync(pathOfIri3)).toBe(true);
  });

  it('retries items if they cannot be stored, removing them from the queue if the maximum retry count is reached', async () => {
    const queue = new Queue({connection});
    await queue.push({iri: 'http://example.org/1234'});

    const storer = new SparqlStorer({
      logger: pino(),
      resourceDir,
      endpointUrl: 'http://localhost', // Unreachable
      query,
    });

    await storer.run({queue});
    const queueSizeAfterRun1 = await queue.size();
    expect(queueSizeAfterRun1).toBe(1);

    await storer.run({queue});
    const queueSizeAfterRun2 = await queue.size();
    expect(queueSizeAfterRun2).toBe(1);

    await storer.run({queue});
    const queueSizeAfterRun3 = await queue.size();
    expect(queueSizeAfterRun3).toBe(0);
  });
});

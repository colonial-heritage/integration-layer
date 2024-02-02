import {DereferenceStorer} from './storer.js';
import {Connection, Queue} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {pino} from 'pino';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

let connection: Connection;
const tmpDir = './tmp';
const resourceDir = join(tmpDir, 'resources');
const dataFile = join(tmpDir, 'data.sqlite');
const filestore = new Filestore({dir: resourceDir});

beforeEach(async () => {
  await rimraf(tmpDir);
  await mkdir(tmpDir, {recursive: true});
  connection = await Connection.new({path: dataFile});
});

describe('run', () => {
  it('stores all items in the queue as files', async () => {
    expect.assertions(6);

    const iri1 = 'http://vocab.getty.edu/aat/300111999';
    const iri2 = 'http://vocab.getty.edu/aat/300027200';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});

    const storer = new DereferenceStorer({
      logger: pino(),
      resourceDir,
      headers: {
        Accept: 'text/turtle', // Getty does not provide correct link headers for JSON
      },
    });

    let numberOfEmits = 0;
    storer.on('processed-resource', (totalNumberOfResources: number) => {
      expect(totalNumberOfResources).toBe(2);
      numberOfEmits++;
    });

    await storer.run({queue});

    expect(numberOfEmits).toBe(2);
    const queueSize = await queue.size();
    expect(queueSize).toBe(0);

    const pathOfIri1 = filestore.createPathFromIri(iri1);
    const pathOfIri2 = filestore.createPathFromIri(iri2);

    expect(existsSync(pathOfIri1)).toBe(true);
    expect(existsSync(pathOfIri2)).toBe(true);
  });

  it('stores the selected number of items in the queue as files', async () => {
    expect.assertions(5);

    const iri1 = 'http://vocab.getty.edu/aat/300111999';
    const iri2 = 'http://vocab.getty.edu/aat/300027200';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});

    const storer = new DereferenceStorer({
      logger: pino(),
      resourceDir,
      headers: {
        Accept: 'text/turtle', // Getty does not provide correct link headers for JSON
      },
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

    const pathOfIri1 = filestore.createPathFromIri(iri1);
    const pathOfIri2 = filestore.createPathFromIri(iri2);

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

    const storer = new DereferenceStorer({
      logger: pino(),
      resourceDir,
      headers: {
        Accept: 'text/turtle', // Getty does not provide correct link headers for JSON
      },
    });

    await storer.run({queue, batchSize: 1});

    const pathOfIri1 = filestore.createPathFromIri(iri1);
    const pathOfIri2 = filestore.createPathFromIri(iri2);
    const pathOfIri3 = filestore.createPathFromIri(iri3);

    expect(existsSync(pathOfIri1)).toBe(true);
    expect(existsSync(pathOfIri2)).toBe(false);
    expect(existsSync(pathOfIri3)).toBe(false);

    await storer.run({queue, batchSize: 2});

    expect(existsSync(pathOfIri2)).toBe(true);
    expect(existsSync(pathOfIri3)).toBe(true);
  });

  it('removes items that result in a 404 or 410 status from the filestore', async () => {
    const iri1 = 'https://httpbin.org/status/404';
    const iri2 = 'https://httpbin.org/status/410';

    const queue = new Queue({connection});
    await queue.push({iri: iri1});
    await queue.push({iri: iri2});

    const storer = new DereferenceStorer({
      logger: pino(),
      resourceDir,
    });

    await storer.run({queue});

    const queueSize = await queue.size();
    expect(queueSize).toBe(0);

    const pathOfIri1 = filestore.createPathFromIri(iri1);
    const pathOfIri2 = filestore.createPathFromIri(iri2);

    expect(existsSync(pathOfIri1)).toBe(false);
    expect(existsSync(pathOfIri2)).toBe(false);
  });

  it('removes items that have action "delete" from the filestore', async () => {
    const iri = 'http://vocab.getty.edu/aat/300111999';
    const pathOfIri = filestore.createPathFromIri(iri);

    const queue = new Queue({connection});

    const storer = new DereferenceStorer({
      logger: pino(),
      resourceDir,
      headers: {
        Accept: 'text/turtle', // Getty does not provide correct link headers for JSON
      },
    });

    // First run: dereference an IRI
    await queue.push({iri});
    await storer.run({queue});

    expect(existsSync(pathOfIri)).toBe(true);

    // Second run: remove an IRI
    await queue.push({iri, action: 'delete'});
    await storer.run({queue});

    expect(existsSync(pathOfIri)).toBe(false);
  });

  it('registers items that result in an error status for retry', async () => {
    const iri = 'https://httpbin.org/status/500';

    const queue = new Queue({connection});
    await queue.push({iri});

    const storer = new DereferenceStorer({
      logger: pino(),
      resourceDir,
    });

    await storer.run({queue});

    // Due to the async queue processing, the retry registration may not have been completed yet
    await setTimeout(100);

    const items = await queue.getAll();

    expect(items[0]).toMatchObject({
      iri,
      retry_count: 1,
    });
  });
});

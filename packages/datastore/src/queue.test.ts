import {Connection} from './connection.js';
import {Queue} from './queue.js';
import {Registry} from './registry.js';
import {join} from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

const tmpDir = './tmp/queue';
const dataFile = join(tmpDir, 'data.sqlite');
let connection: Connection;

beforeEach(async () => {
  await rimraf(tmpDir);
  connection = await Connection.new({path: dataFile});
});

describe('new', () => {
  it('returns a new instance', () => {
    const queue = new Queue({connection});

    expect(queue).toBeInstanceOf(Queue);
  });
});

describe('push', () => {
  it('pushes an item', async () => {
    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org'});

    const items = await queue.getAll();

    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      iri: 'https://example.org',
      retry_count: 0,
    });
  });

  it('pushes an item with additional information', async () => {
    const queue = new Queue({connection});

    await queue.push({
      iri: 'https://example.org',
      type: 'type1',
      retry_count: 1,
    });

    const items = await queue.getAll();

    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      iri: 'https://example.org',
      type: 'type1',
      retry_count: 1,
    });
  });

  it('pushes an item with an IRI that already exists', async () => {
    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org'});
    await queue.push({iri: 'https://example.org'});

    const items = await queue.getAll();

    expect(items.length).toBe(1);
    expect(items[0].iri).toEqual('https://example.org');
  });
});

describe('retry', () => {
  it('retries an item', async () => {
    const queue = new Queue({connection});

    const originalItem = await queue.push({
      iri: 'https://example.org/1',
      type: 'type1',
    });
    await queue.push({iri: 'https://example.org/2'});

    await queue.retry(originalItem);

    const items = await queue.getAll();

    expect(items.length).toBe(2);
    expect(items[0]).toMatchObject({
      id: 2,
      iri: 'https://example.org/2',
      type: null,
      retry_count: 0,
    });
    expect(items[1]).toMatchObject({
      id: 3,
      iri: 'https://example.org/1',
      type: 'type1',
      retry_count: 1,
    });
  });

  it('throws if max retry count is reached', async () => {
    expect.assertions(1);

    const queue = new Queue({connection, maxRetryCount: 1});
    const originalItem = await queue.push({iri: 'https://example.org'});
    const retryItem = await queue.retry(originalItem);

    try {
      await queue.retry(retryItem);
    } catch (err) {
      const error = err as Error;
      expect(error.message).toEqual(
        'Cannot retry "https://example.org": max retry count of 1 reached'
      );
    }
  });
});

describe('remove', () => {
  it('removes an item', async () => {
    const queue = new Queue({connection});

    const item = await queue.push({iri: 'https://example.org'});

    await queue.remove(item.id);

    const items = await queue.getAll();

    expect(items.length).toBe(0);
  });
});

describe('processAndSave', () => {
  it('processes an item, adding it to the registry', async () => {
    const iri = 'https://example.org';

    const queue = new Queue({connection});
    const item = await queue.push({iri});

    await queue.processAndSave(item);

    const queuedItems = await queue.getAll();

    // Removed from queue
    expect(queuedItems.length).toBe(0);

    const registry = new Registry({connection});
    const registeredItems = await registry.getAll();

    // Added to registry
    expect(registeredItems.length).toBe(1);
    expect(registeredItems[0].iri).toEqual(iri);
  });
});

describe('processAndRemove', () => {
  it('processes an item, removing it from the registry', async () => {
    const iri = 'https://example.org';

    const registry = new Registry({connection});
    registry.save({iri});

    const queue = new Queue({connection});
    const item = await queue.push({iri});

    await queue.processAndRemove(item);

    const queuedItems = await queue.getAll();

    // Removed from queue
    expect(queuedItems.length).toBe(0);

    const registeredItems = await registry.getAll();

    // Removed from registry
    expect(registeredItems.length).toBe(0);
  });
});

describe('getAll', () => {
  it('gets all items, sorted by date of creation', async () => {
    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org/1'});
    await setTimeout(1000); // To get a different date of creation
    await queue.push({iri: 'https://example.org/2'});

    const items = await queue.getAll();

    expect(items.length).toBe(2);
    expect(items[0].id).toEqual(1);
    expect(items[1].id).toEqual(2);
  });

  it('gets a limited number of items', async () => {
    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org/1'});
    await queue.push({iri: 'https://example.org/2'});

    const items = await queue.getAll({limit: 1});

    expect(items.length).toBe(1);
    expect(items[0].id).toEqual(1);
  });

  it('gets the items belonging to a specific type', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    await queue.push({iri, type: 'type1'});
    await queue.push({iri});

    const items = await queue.getAll({type: 'type1'});

    expect(items.length).toBe(1);
    expect(items[0].id).toEqual(1);
  });
});

describe('size', () => {
  it('gets the number of items', async () => {
    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org'});

    const size = await queue.size();

    expect(size).toBe(1);
  });

  it('gets the number of items belonging to a specific type', async () => {
    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org/1', type: 'type1'});
    await queue.push({iri: 'https://example.org/2'});

    const size = await queue.size({type: 'type1'});

    expect(size).toBe(1);
  });
});

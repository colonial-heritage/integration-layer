import {Connection} from './connection.js';
import {Queue} from './queue.js';
import {Registry} from './registry.js';
import {join} from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

const tmpDir = './tmp';
const dataFile = join(tmpDir, 'queue.sqlite');
let connection: Connection;

beforeEach(async () => {
  await rimraf(tmpDir);
  connection = await Connection.new({path: dataFile});
});

describe('new', () => {
  it('returns a new instance', async () => {
    const queue = new Queue({connection});

    expect(queue).toBeInstanceOf(Queue);
  });
});

describe('push', async () => {
  it('pushes an item', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    await queue.push({iri});

    const items = await queue.getAll();

    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      iri,
      retry_count: 0,
    });
  });

  it('pushes an item with a retry count', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    await queue.push({iri, retry_count: 1});

    const items = await queue.getAll();

    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      iri,
      retry_count: 1,
    });
  });
});

describe('retry', async () => {
  it('retries an item', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org/';

    const originalItem = await queue.push({iri});
    await queue.push({iri});

    await queue.retry(originalItem);

    const items = await queue.getAll();

    expect(items.length).toBe(2);
    expect(items[0].retry_count).toEqual(0);
    expect(items[1].retry_count).toEqual(1);
  });

  it('throws if max retry count is reached', async () => {
    expect.assertions(1);

    const queue = new Queue({connection, maxRetryCount: 1});
    const iri = 'https://example.org/';

    const originalItem = await queue.push({iri});
    const retryItem = await queue.retry(originalItem);

    try {
      await queue.retry(retryItem);
    } catch (err) {
      const error = err as Error;
      expect(error.message).toEqual(
        'Cannot retry "https://example.org/": max retry count of 1 reached'
      );
    }
  });
});

describe('remove', async () => {
  it('removes an item', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    const item = await queue.push({iri});

    await queue.remove(item.id);

    const items = await queue.getAll();

    expect(items.length).toBe(0);
  });
});

describe('processed', async () => {
  it('processes an item', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    const item = await queue.push({iri});

    await queue.processed(item);

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

describe('getAll', async () => {
  it('gets all items, sorted by date of creation', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    await queue.push({iri});
    await setTimeout(1000); // To get a different date of creation
    await queue.push({iri});

    const items = await queue.getAll();

    expect(items.length).toBe(2);
    expect(items[0].id).toEqual(1);
    expect(items[1].id).toEqual(2);
  });

  it('gets a limited number of items', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    await queue.push({iri});
    await queue.push({iri});

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

describe('size', async () => {
  it('gets the number of items', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    await queue.push({iri});

    const size = await queue.size();

    expect(size).toBe(1);
  });

  it('gets the number of items belonging to a specific type', async () => {
    const queue = new Queue({connection});
    const iri = 'https://example.org';

    await queue.push({iri, type: 'type1'});
    await queue.push({iri});

    const size = await queue.size({type: 'type1'});

    expect(size).toBe(1);
  });
});

import {Connection} from './connection.js';
import {Queue} from './queue.js';
import {Registry} from './registry.js';
import {join} from 'node:path';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

const tmpDir = './tmp/registry';
const dataFile = join(tmpDir, 'data.sqlite');
let connection: Connection;

beforeEach(async () => {
  await rimraf(tmpDir);
  connection = await Connection.new({path: dataFile});
});

describe('new', () => {
  it('returns a new instance', () => {
    const registry = new Registry({connection});

    expect(registry).toBeInstanceOf(Registry);
  });
});

describe('save', () => {
  it('saves an item', async () => {
    const iri = 'https://example.org';
    const registry = new Registry({connection});

    await registry.save({iri});

    const items = await registry.getAll();

    expect(items.length).toBe(1);
    expect(items[0].iri).toEqual(iri);
  });

  it('saves an item with an IRI that already exists', async () => {
    const iri = 'https://example.org';
    const registry = new Registry({connection});

    await registry.save({iri});
    await registry.save({iri});

    const items = await registry.getAll();

    expect(items.length).toBe(1);
    expect(items[0].iri).toEqual(iri);
  });
});

describe('remove', () => {
  it('removes an item', async () => {
    const iri = 'https://example.org';
    const registry = new Registry({connection});

    await registry.save({iri});
    await registry.remove(iri);

    const items = await registry.getAll();

    expect(items.length).toBe(0);
  });
});

describe('removeIfNotInQueue', () => {
  it('removes items that are not in the queue', async () => {
    const registry = new Registry({connection});

    await registry.save({iri: 'https://example.org/1'});
    await registry.save({iri: 'https://example.org/2'});

    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org/1'});

    const removedItems = await registry.removeIfNotInQueue();

    expect(removedItems.length).toBe(1);
    expect(removedItems[0].iri).toEqual('https://example.org/2');
  });

  it('removes items belonging to a specific type that are not in the queue', async () => {
    const registry = new Registry({connection});

    await registry.save({iri: 'https://example.org/1', type: 'type1'});
    await registry.save({iri: 'https://example.org/2', type: 'type2'});
    await registry.save({iri: 'https://example.org/3', type: 'type1'});

    const queue = new Queue({connection});

    await queue.push({iri: 'https://example.org/1', type: 'type1'});

    const removedItems = await registry.removeIfNotInQueue({type: 'type1'});

    expect(removedItems.length).toBe(1);
    expect(removedItems[0].iri).toEqual('https://example.org/3');
  });

  it('removes all items if queue is empty', async () => {
    const registry = new Registry({connection});

    await registry.save({iri: 'https://example.org/1'});
    await registry.save({iri: 'https://example.org/2'});

    const removedItems = await registry.removeIfNotInQueue();

    expect(removedItems.length).toBe(2);
  });
});

import {Filestore} from './filestore.js';
import {existsSync} from 'node:fs';
import {rm} from 'node:fs/promises';
import rdfDereferencer from 'rdf-dereference';
import {beforeEach, describe, expect, it} from 'vitest';

// Required to use ESM in both TypeScript and JavaScript
const dereferencer = rdfDereferencer.default ?? rdfDereferencer;

const tmpDir = './tmp/';
let filestore: Filestore;

async function getQuadStreamFromFile(path: string) {
  const {data} = await dereferencer.dereference(path, {
    localFiles: true,
  });

  return data;
}

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  filestore = new Filestore({dir: tmpDir});
});

describe('createHashFromId', () => {
  it('creates a hash from an ID', async () => {
    const hash = filestore.createHashFromId('http://localhost/resource');

    expect(hash).toEqual('d388f3dc1aaec96db5e05936bfb1aa0b');
  });
});

describe('createPathFromId', () => {
  it('creates a path from an ID', async () => {
    const path = filestore.createPathFromId('http://localhost/resource');

    expect(path.endsWith('tmp/b/0/d388f3dc1aaec96db5e05936bfb1aa0b.nt')).toBe(
      true
    );
  });
});

describe('removeById', () => {
  const id = 'http://localhost/resource';

  it('does not throw if a resource does not exist', async () => {
    await filestore.removeById(id);
  });

  it('removes a resource', async () => {
    const quadStream = await getQuadStreamFromFile('./fixtures/resource.ttl');
    await filestore.save({id, quadStream});

    const path = filestore.createPathFromId(id);
    expect(existsSync(path)).toBe(true);

    await filestore.removeById(id);

    expect(existsSync(path)).toBe(false);
  });
});

describe('removeAll', () => {
  it('does not throw if the resource directory does not exist', async () => {
    await filestore.removeAll();
  });

  it('removes all resources', async () => {
    const id = 'http://localhost/resource';
    const quadStream = await getQuadStreamFromFile('./fixtures/resource.ttl');
    await filestore.save({id, quadStream});

    expect(existsSync(tmpDir)).toBe(true);
    await filestore.removeAll();
    expect(existsSync(tmpDir)).toBe(false);
  });
});

describe('save', () => {
  const id = 'http://localhost/resource';

  it('saves a resource', async () => {
    const quadStream = await getQuadStreamFromFile('./fixtures/resource.ttl');

    await filestore.save({id, quadStream});

    const path = filestore.createPathFromId(id);
    expect(existsSync(path)).toBe(true);
  });

  it('removes a resource if resource is empty', async () => {
    const quadStream = await getQuadStreamFromFile(
      './fixtures/empty-resource.ttl'
    );

    await filestore.save({id, quadStream});

    const path = filestore.createPathFromId(id);
    expect(existsSync(path)).toBe(false);
  });
});

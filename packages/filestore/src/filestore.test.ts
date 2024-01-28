import {Filestore} from './filestore.js';
import {existsSync} from 'node:fs';
import rdfDereferencer from 'rdf-dereference';
import {rimraf} from 'rimraf';
import {beforeEach, describe, expect, it} from 'vitest';

// Required to use ESM in both TypeScript and JavaScript
const dereferencer = rdfDereferencer.default ?? rdfDereferencer;

const dir = './tmp/';
let filestore: Filestore;

async function getQuadStreamFromFile(path: string) {
  const {data} = await dereferencer.dereference(path, {
    localFiles: true,
  });

  return data;
}

beforeEach(async () => {
  await rimraf(dir);
  filestore = new Filestore({dir});
});

describe('createHashFromIri', () => {
  it('creates a path from an IRI', async () => {
    const hash = filestore.createHashFromIri('http://localhost/resource');

    expect(hash).toEqual('d388f3dc1aaec96db5e05936bfb1aa0b');
  });
});

describe('createPathFromIri', () => {
  it('creates a path from an IRI', async () => {
    const path = filestore.createPathFromIri('http://localhost/resource');

    expect(path.endsWith('tmp/b/0/d388f3dc1aaec96db5e05936bfb1aa0b.nt')).toBe(
      true
    );
  });
});

describe('deleteByIri', () => {
  const iri = 'http://localhost/resource';

  it('does not throw if a resource does not exist', async () => {
    await filestore.deleteByIri('http://localhost/doesnotexist');
  });

  it('deletes a resource', async () => {
    const quadStream = await getQuadStreamFromFile('./fixtures/resource.ttl');
    await filestore.save({iri, quadStream});

    const path = filestore.createPathFromIri(iri);
    expect(existsSync(path)).toBe(true);

    await filestore.deleteByIri(iri);

    expect(existsSync(path)).toBe(false);
  });
});

describe('save', () => {
  const iri = 'http://localhost/resource';

  it('saves a resource', async () => {
    const quadStream = await getQuadStreamFromFile('./fixtures/resource.ttl');

    await filestore.save({iri, quadStream});

    const path = filestore.createPathFromIri(iri);
    expect(existsSync(path)).toBe(true);
  });

  it('deletes a resource if resource is empty', async () => {
    const quadStream = await getQuadStreamFromFile(
      './fixtures/empty-resource.ttl'
    );

    await filestore.save({iri, quadStream});

    const path = filestore.createPathFromIri(iri);
    expect(existsSync(path)).toBe(false);
  });
});

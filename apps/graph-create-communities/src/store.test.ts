import {
  storeCommunitiesAsRdfInFile,
  StoreCommunitiesAsRdfInFileSchemaInput,
  storePersonsAsRdfInFile,
  StorePersonsAsRdfInFileSchemaInput,
} from './store.js';
import {existsSync} from 'node:fs';
import {mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pino} from 'pino';
import {beforeEach, describe, expect, it} from 'vitest';
import {createActor, toPromise} from 'xstate';

const logger = pino();
const tmpDir = './tmp';

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  await mkdir(tmpDir, {recursive: true});
});

describe('storeCommunitiesAsRdfInFile', () => {
  it('stores communities', async () => {
    const input: StoreCommunitiesAsRdfInFileSchemaInput = {
      logger,
      resourceDir: tmpDir,
      communities: [
        {
          iri: 'https://example.org/1',
          id: '1',
          name: 'Example 1',
        },
      ],
    };

    await toPromise(createActor(storeCommunitiesAsRdfInFile, {input}).start());

    const outputFile = join(tmpDir, 'communities.nt');
    expect(existsSync(outputFile)).toBe(true);
  });
});

describe('storePersonsAsRdfInFile', () => {
  it('stores persons', async () => {
    const input: StorePersonsAsRdfInFileSchemaInput = {
      logger,
      resourceDir: tmpDir,
      persons: [
        {
          iri: 'https://example.org/1',
          id: '1',
        },
      ],
    };

    await toPromise(createActor(storePersonsAsRdfInFile, {input}).start());

    const outputFile = join(tmpDir, 'persons.nt');
    expect(existsSync(outputFile)).toBe(true);
  });
});

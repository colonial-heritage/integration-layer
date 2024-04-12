import {
  storeCommunitiesAsRdfInFile,
  StoreCommunitiesAsRdfInFileSchemaInput,
} from './store.js';
import {existsSync} from 'node:fs';
import {mkdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pino} from 'pino';
import {beforeEach, describe, expect, it} from 'vitest';
import {createActor, toPromise} from 'xstate';

const logger = pino();
const tmpDir = './tmp';
const communitiesFile = join(tmpDir, 'communities.nt');

beforeEach(async () => {
  await rm(tmpDir, {recursive: true, force: true});
  await mkdir(tmpDir, {recursive: true});
});

describe('storeCommunitiesAsRdfInFile', () => {
  it('stores communities', async () => {
    const input: StoreCommunitiesAsRdfInFileSchemaInput = {
      logger,
      file: communitiesFile,
      communities: [
        {
          iri: 'https://example.org/1',
          id: '1',
          name: 'Example 1',
        },
      ],
    };

    await toPromise(createActor(storeCommunitiesAsRdfInFile, {input}).start());

    expect(existsSync(communitiesFile)).toBe(true);
  });
});

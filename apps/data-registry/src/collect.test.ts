import {collectRdfFiles, CollectRdfFilesInput} from './collect.js';
import {pino} from 'pino';
import {describe, expect, it} from 'vitest';
import {createActor, toPromise} from 'xstate';

const logger = pino();

describe('collectRdfFiles', () => {
  it('collects RDF files', async () => {
    const input: CollectRdfFilesInput = {
      logger,
      globPattern: './fixtures/**/*',
      graphBaseIri: 'http://example.org/',
    };

    const rdfFiles = await toPromise(
      createActor(collectRdfFiles, {input}).start()
    );

    expect(rdfFiles).toStrictEqual([
      {
        file: 'fixtures/2',
        graph: 'http://example.org/2',
      },
      {
        file: 'fixtures/1.ttl',
        graph: 'http://example.org/1',
      },
      {
        file: 'fixtures/deep/4.ext.ttl',
        graph: 'http://example.org/4',
      },
      {
        file: 'fixtures/deep/3.ttl',
        graph: 'http://example.org/3',
      },
    ]);
  });
});

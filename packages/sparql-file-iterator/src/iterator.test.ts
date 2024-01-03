import {SparqlFileIterator} from './iterator.js';
import fastq from 'fastq';
import {describe, expect, it} from 'vitest';

const query = `
  PREFIX ex: <http://example.org/>
  SELECT ?this
  WHERE {
    [] ex:feature ?this .
  }
`;

describe('run', () => {
  it('iterates even if there are no files', async () => {
    const savedIris: string[] = [];
    const save = async (iri: string) => savedIris.push(iri);
    const queue = fastq.promise(save, 1);

    const iterator = new SparqlFileIterator({
      dir: './fixtures/no-files',
      query,
      queue,
    });

    await iterator.run();

    expect(savedIris).toEqual([]);
  });

  it('iterates even if the "?this" binding is missing in the results', async () => {
    const savedIris: string[] = [];
    const save = async (iri: string) => savedIris.push(iri);
    const queue = fastq.promise(save, 1);

    const query = `
      PREFIX ex: <http://example.org/>
      SELECT ?s
      WHERE {
        ?s ex:feature ?this .
      }
    `;

    const iterator = new SparqlFileIterator({
      dir: './fixtures/files',
      query,
      queue,
    });

    await iterator.run();

    expect(savedIris).toEqual([]);
  });

  it('iterates', async () => {
    const savedIris: string[] = [];
    const save = async (iri: string) => savedIris.push(iri);
    const queue = fastq.promise(save, 1);

    const iterator = new SparqlFileIterator({
      dir: './fixtures/files',
      query,
      queue,
    });

    let numberOfEmits = 0;
    let numberOfIris = 0;
    const filenames: string[] = [];

    iterator.on(
      'collected-iris',
      (numberOfIrisInFile: number, filename: string) => {
        numberOfEmits++;
        numberOfIris += numberOfIrisInFile;
        filenames.push(filename);
      }
    );

    await iterator.run();

    expect(numberOfEmits).toBe(3);
    expect(numberOfIris).toBe(4);
    expect(savedIris).toStrictEqual([
      'http://example.org/b',
      'http://example.org/c',
      'http://example.org/a',
      'http://example.org/b',
    ]);
    expect(filenames).toEqual([
      expect.stringContaining('/fixtures/files/2.ttl'),
      expect.stringContaining('/fixtures/files/1.ttl'),
      expect.stringContaining('/fixtures/files/deep/3.ttl'),
    ]);
  });
});

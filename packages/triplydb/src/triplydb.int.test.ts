import {TriplyDb} from './triplydb.js';
import {env} from 'node:process';
import {pino} from 'pino';
import {describe, it} from 'vitest';

const triplyDb = await TriplyDb.new({
  logger: pino(),
  instanceUrl: env.TRIPLYDB_INSTANCE_URL as string,
  apiToken: env.TRIPLYDB_API_TOKEN as string,
  account: env.TRIPLYDB_ACCOUNT_DEVELOPMENT as string,
  dataset: env.TRIPLYDB_DATASET_KG_DEVELOPMENT as string,
});

describe('upsertGraphFromFile', () => {
  it('upserts a graph from a file', async () => {
    await triplyDb.upsertGraphFromFile({
      file: './fixtures/graph.nt',
      graph: 'https://example.org/file-integration-test',
    });
  });

  it('does not upsert a graph if the file is empty', async () => {
    await triplyDb.upsertGraphFromFile({
      file: './fixtures/empty.nt',
      graph: 'https://example.org/dir-integration-test',
    });
  });
});

describe('upsertGraphFromDirectory', () => {
  it('upserts a graph from a directory', async () => {
    await triplyDb.upsertGraphFromDirectory({
      dir: './fixtures/files',
      graph: 'https://example.org/dir-integration-test',
    });
  });

  it('does not upsert a graph from a directory if there are no files', async () => {
    await triplyDb.upsertGraphFromDirectory({
      dir: './fixtures/no-files',
      graph: 'https://example.org/dir-integration-test',
    });
  });
});

describe('restartService', () => {
  it('restarts a service', async () => {
    await triplyDb.restartService({
      name: 'kg',
      type: 'virtuoso',
    });
  });
});

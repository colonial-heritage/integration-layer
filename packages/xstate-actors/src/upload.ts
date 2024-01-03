import {TriplyDb} from '@colonial-collections/triplydb';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  resourceDir: z.string(),
  triplydbInstanceUrl: z.string(),
  triplydbApiToken: z.string(),
  triplydbAccount: z.string(),
  triplydbDataset: z.string(),
  triplydbServiceName: z.string(),
  triplydbServiceType: z.string(),
  graphName: z.string(),
  tempDir: z.string().optional(),
});

export type UploadInput = z.input<typeof inputSchema>;

export const upload = fromPromise(async ({input}: {input: UploadInput}) => {
  const opts = inputSchema.parse(input);

  const triplyDb = await TriplyDb.new({
    logger: opts.logger,
    instanceUrl: opts.triplydbInstanceUrl,
    apiToken: opts.triplydbApiToken,
    account: opts.triplydbAccount,
    dataset: opts.triplydbDataset,
  });

  await triplyDb.upsertGraphFromDirectory({
    graph: opts.graphName,
    dir: opts.resourceDir,
    dirTemp: opts.tempDir,
  });

  await triplyDb.restartService({
    name: opts.triplydbServiceName,
    type: opts.triplydbServiceType,
  });
});

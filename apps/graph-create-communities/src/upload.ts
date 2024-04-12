import {TriplyDb} from '@colonial-collections/triplydb';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  file: z.string(),
  graph: z.string(),
  triplydbInstanceUrl: z.string(),
  triplydbApiToken: z.string(),
  triplydbAccount: z.string(),
  triplydbDataset: z.string(),
  triplydbService: z.string(),
  triplydbServiceTemplatesFile: z.string().optional(),
});

export type UploadInput = z.input<typeof inputSchema>;

export const uploadRdfFile = fromPromise(
  async ({input}: {input: UploadInput}) => {
    const opts = inputSchema.parse(input);

    const triplyDb = await TriplyDb.new({
      logger: opts.logger,
      instanceUrl: opts.triplydbInstanceUrl,
      apiToken: opts.triplydbApiToken,
      account: opts.triplydbAccount,
      dataset: opts.triplydbDataset,
    });

    await triplyDb.upsertGraphFromFile({
      graph: opts.graph,
      file: opts.file,
    });

    await triplyDb.restartService({
      name: opts.triplydbService,
      templatesFile: opts.triplydbServiceTemplatesFile,
    });
  }
);

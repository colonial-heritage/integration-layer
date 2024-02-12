import {TriplyDb} from '@colonial-collections/triplydb';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const updateServiceInputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  resourceDir: z.string(),
  triplydbInstanceUrl: z.string(),
  triplydbApiToken: z.string(),
  triplydbAccount: z.string(),
  triplydbDataset: z.string(),
  triplydbService: z.string(),
  triplydbServiceTemplatesFile: z.string().optional(),
  graphName: z.string(),
  tempDir: z.string().optional(),
});

export type UpdateServiceInput = z.input<typeof updateServiceInputSchema>;

export const updateService = fromPromise(
  async ({input}: {input: UpdateServiceInput}) => {
    const opts = updateServiceInputSchema.parse(input);

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
      name: opts.triplydbService,
      templatesFile: opts.triplydbServiceTemplatesFile,
    });
  }
);

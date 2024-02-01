import {TriplyDb} from '@colonial-collections/triplydb';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  filesAndGraphs: z.array(
    z.object({
      file: z.string(),
      graph: z.string(),
    })
  ),
  triplydbInstanceUrl: z.string(),
  triplydbApiToken: z.string(),
  triplydbAccount: z.string(),
  triplydbDataset: z.string(),
});

export type UploadInput = z.input<typeof inputSchema>;

export const uploadRdfFiles = fromPromise(
  async ({input}: {input: UploadInput}) => {
    const opts = inputSchema.parse(input);

    const triplyDb = await TriplyDb.new({
      logger: opts.logger,
      instanceUrl: opts.triplydbInstanceUrl,
      apiToken: opts.triplydbApiToken,
      account: opts.triplydbAccount,
      dataset: opts.triplydbDataset,
    });

    for (const fileAndGraph of opts.filesAndGraphs) {
      await triplyDb.upsertGraphFromFile({
        graph: fileAndGraph.graph,
        file: fileAndGraph.file,
      });
    }

    await triplyDb.restartServices();
  }
);

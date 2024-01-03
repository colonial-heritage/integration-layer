import {Registry} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const inputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  registry: z.instanceof(Registry),
  type: z.string().optional(),
  resourceDir: z.string(),
});

export type RemoveObsoleteInput = z.input<typeof inputSchema>;

// Compare the queued IRIs with those previously stored on file,
// removing resources that have become obsolete
export const removeObsoleteResources = fromPromise(
  async ({input}: {input: RemoveObsoleteInput}) => {
    const opts = inputSchema.parse(input);

    opts.logger.info(`Removing obsolete resources in "${opts.resourceDir}"`);

    const filestore = new Filestore({dir: opts.resourceDir});
    const removedItems = await opts.registry.removeIfNotInQueue({
      type: opts.type,
    });

    for (const item of removedItems) {
      await filestore.deleteByIri(item.iri);
    }

    opts.logger.info(
      `Removed ${removedItems.length} obsolete resources in "${opts.resourceDir}"`
    );
  }
);

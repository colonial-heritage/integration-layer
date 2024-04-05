import {Registry} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const removeObsoleteResourcesNotInQueueInputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  registry: z.instanceof(Registry),
  type: z.string().optional(),
  resourceDir: z.string(),
});

export type RemoveObsoleteResourcesNotInQueueInput = z.input<
  typeof removeObsoleteResourcesNotInQueueInputSchema
>;

// Compare the queued IRIs with those previously stored on file,
// removing resources that have become obsolete
export const removeObsoleteResourcesNotInQueue = fromPromise(
  async ({input}: {input: RemoveObsoleteResourcesNotInQueueInput}) => {
    const opts = removeObsoleteResourcesNotInQueueInputSchema.parse(input);

    opts.logger.info(`Removing obsolete resources in "${opts.resourceDir}"`);

    const filestore = new Filestore({dir: opts.resourceDir});
    const removedItems = await opts.registry.removeIfNotInQueue({
      type: opts.type,
    });

    for (const item of removedItems) {
      await filestore.deleteById(item.iri);
    }

    opts.logger.info(
      `Removed ${removedItems.length} obsolete resources in "${opts.resourceDir}"`
    );
  }
);

const removeAllResourcesInputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  resourceDir: z.string(),
});

export type RemoveAllResources = z.input<typeof removeAllResourcesInputSchema>;

export const removeAllResources = fromPromise(
  async ({input}: {input: RemoveAllResources}) => {
    const opts = removeAllResourcesInputSchema.parse(input);

    opts.logger.info(`Removing all resources in "${opts.resourceDir}"`);

    // Depending on the size of the directory this action can take some time
    const filestore = new Filestore({dir: opts.resourceDir});
    await filestore.deleteAll();

    opts.logger.info(`Removed all resources in "${opts.resourceDir}"`);
  }
);

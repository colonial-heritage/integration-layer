import {Registry} from '@colonial-collections/datastore';
import {Filestore} from '@colonial-collections/filestore';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const removeResourcesInputSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  registry: z.instanceof(Registry),
  type: z.string().optional(),
  resourceDir: z.string(),
});

export type RemoveResourcesInput = z.input<typeof removeResourcesInputSchema>;

// Compare the queued IRIs with those previously stored on file,
// removing resources that have become obsolete
export const removeResourcesNotInQueue = fromPromise(
  async ({input}: {input: RemoveResourcesInput}) => {
    const opts = removeResourcesInputSchema.parse(input);

    opts.logger.info(`Removing obsolete resources in "${opts.resourceDir}"`);

    const removedItems = await opts.registry.removeIfNotInQueue({
      type: opts.type,
    });

    const filestore = new Filestore({dir: opts.resourceDir});
    for (const item of removedItems) {
      await filestore.removeById(item.iri);
    }

    opts.logger.info(
      `Removed ${removedItems.length} obsolete resources in "${opts.resourceDir}"`
    );
  }
);

export const removeAllResources = fromPromise(
  async ({input}: {input: RemoveResourcesInput}) => {
    const opts = removeResourcesInputSchema.parse(input);

    opts.logger.info(`Removing all resources in "${opts.resourceDir}"`);

    await opts.registry.removeAll();

    const filestore = new Filestore({dir: opts.resourceDir});
    await filestore.removeAll(); // Depending on the size of the directory this action can take some time

    opts.logger.info(`Removed all resources in "${opts.resourceDir}"`);
  }
);

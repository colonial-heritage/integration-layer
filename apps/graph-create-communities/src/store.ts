import {
  communitySchema,
  CommunityStorer,
} from '@colonial-collections/community-storer';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const storeCommunitiesAsRdfInFileSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  file: z.string(),
  communities: z.array(communitySchema),
});

export type StoreCommunitiesAsRdfInFileSchemaInput = z.infer<
  typeof storeCommunitiesAsRdfInFileSchema
>;

export const storeCommunitiesAsRdfInFile = fromPromise(
  async ({input}: {input: StoreCommunitiesAsRdfInFileSchemaInput}) => {
    const opts = storeCommunitiesAsRdfInFileSchema.parse(input);

    opts.logger.info('Storing communities as RDF in file');

    const storer = new CommunityStorer();
    await storer.toFile({path: opts.file, communities: opts.communities});
  }
);

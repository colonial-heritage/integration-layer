import {
  communitySchema,
  personSchema,
  Storer,
} from '@colonial-collections/community-storer';
import {join} from 'node:path';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const storeCommunitiesAsRdfInFileSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  resourceDir: z.string(),
  communities: z.array(communitySchema),
});

export type StoreCommunitiesAsRdfInFileSchemaInput = z.infer<
  typeof storeCommunitiesAsRdfInFileSchema
>;

export const storeCommunitiesAsRdfInFile = fromPromise(
  async ({input}: {input: StoreCommunitiesAsRdfInFileSchemaInput}) => {
    const opts = storeCommunitiesAsRdfInFileSchema.parse(input);

    opts.logger.info('Storing communities as RDF in file');

    const path = join(opts.resourceDir, 'communities.nt');
    const storer = new Storer();
    await storer.writeCommunitiesToFile({path, communities: opts.communities});
  }
);

const storePersonsAsRdfInFileSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
  resourceDir: z.string(),
  persons: z.array(personSchema),
});

export type StorePersonsAsRdfInFileSchemaInput = z.infer<
  typeof storePersonsAsRdfInFileSchema
>;

export const storePersonsAsRdfInFile = fromPromise(
  async ({input}: {input: StorePersonsAsRdfInFileSchemaInput}) => {
    const opts = storePersonsAsRdfInFileSchema.parse(input);

    opts.logger.info('Storing persons as RDF in file');

    const path = join(opts.resourceDir, 'persons.nt');
    const storer = new Storer();
    await storer.writePersonsToFile({path, persons: opts.persons});
  }
);

import {Fetcher} from '@colonial-collections/community-storer';
import {fromPromise} from 'xstate';
import {z} from 'zod';

const fetchCommunitiesSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
});

export type FetchCommunitiesInput = z.infer<typeof fetchCommunitiesSchema>;

export const fetchCommunities = fromPromise(
  async ({input}: {input: FetchCommunitiesInput}) => {
    const opts = fetchCommunitiesSchema.parse(input);

    opts.logger.info('Fetching communities from the data source');

    const fetcher = new Fetcher();
    const communities = await fetcher.getCommunities();

    opts.logger.info(
      `Found ${communities.length} communities in the data source`
    );

    return communities;
  }
);

const fetchPersonsSchema = z.object({
  logger: z.any().refine(val => val !== undefined, {
    message: 'logger must be defined',
  }),
});

export type FetchPersonsInput = z.infer<typeof fetchPersonsSchema>;

export const fetchPersons = fromPromise(
  async ({input}: {input: FetchPersonsInput}) => {
    const opts = fetchPersonsSchema.parse(input);

    opts.logger.info('Fetching persons from the data source');

    const fetcher = new Fetcher();
    const persons = await fetcher.getPersons();

    opts.logger.info(`Found ${persons.length} persons in the data source`);

    return persons;
  }
);

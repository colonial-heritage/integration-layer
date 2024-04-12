import {CommunityFetcher} from '@colonial-collections/community-storer';
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

    const fetcher = new CommunityFetcher();
    const communities = await fetcher.getAll();

    opts.logger.info(
      `Found ${communities.length} communities in the data source`
    );

    return communities;
  }
);

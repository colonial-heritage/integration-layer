import {CommunityFetcher} from './fetcher.js';
import clerk from '@clerk/clerk-sdk-node';
import {afterEach, describe, expect, it, vi} from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

function createCommunityBatch() {
  const communityBatch = [];

  // 100 is the max that the fetcher retrieves per call from the data source
  for (let i = 0; i < 100; i++) {
    const id = Date.now();
    communityBatch.push({
      id,
      name: `Name ${id}`,
      publicMetadata: {
        iri: `https://example.org/${id}`,
      },
    });
  }

  return communityBatch;
}

describe('getAll', () => {
  it('gets all communities', async () => {
    const communityBatch1 = createCommunityBatch();
    const communityBatch2 = createCommunityBatch();

    const organizationListSpy = vi
      .spyOn(clerk.organizations, 'getOrganizationList')
      // @ts-expect-error:TS2740
      .mockResolvedValueOnce(communityBatch1)
      // @ts-expect-error:TS2740
      .mockResolvedValueOnce(communityBatch2);

    const fetcher = new CommunityFetcher();
    const communities = await fetcher.getAll();

    expect(organizationListSpy).toHaveBeenCalledTimes(3);
    expect(communities).toHaveLength(200);
    expect(communities[0]).toStrictEqual({
      iri: expect.stringContaining('https://example.org/'),
      id: expect.stringMatching(/.+/),
      name: expect.stringContaining('Name '),
    });
  });
});

import {Fetcher} from './fetcher.js';
import {clerkClient} from '@clerk/clerk-sdk-node';
import {afterEach, describe, expect, it, vi} from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getCommunities', () => {
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

    return {data: communityBatch};
  }

  it('gets the communities', async () => {
    const communityBatch1 = createCommunityBatch();
    const communityBatch2 = createCommunityBatch();

    const organizationListSpy = vi
      .spyOn(clerkClient.organizations, 'getOrganizationList')
      // @ts-expect-error:TS2345
      .mockResolvedValueOnce(communityBatch1)
      // @ts-expect-error:TS2345
      .mockResolvedValueOnce(communityBatch2);

    const fetcher = new Fetcher();
    const communities = await fetcher.getCommunities();

    expect(organizationListSpy).toHaveBeenCalledTimes(3); // Initial call + two recursive calls
    expect(communities).toHaveLength(200); // 2 batches; 100 communities per batch
    expect(communities[0]).toStrictEqual({
      iri: expect.stringContaining('https://example.org/'),
      id: expect.stringMatching(/.+/),
      name: expect.stringContaining('Name '),
    });
  });
});

describe('getPersons', () => {
  function createPersonBatch() {
    const personBatch = [];

    // 100 is the max that the fetcher retrieves per call from the data source
    for (let i = 0; i < 100; i++) {
      const id = Date.now();
      personBatch.push({
        id,
        publicMetadata: {
          iri: `https://example.org/${id}`,
        },
      });
    }

    return {data: personBatch};
  }

  it('gets the persons', async () => {
    const personBatch1 = createPersonBatch();
    const personBatch2 = createPersonBatch();

    const userListSpy = vi
      .spyOn(clerkClient.users, 'getUserList')
      // @ts-expect-error:TS2345
      .mockResolvedValueOnce(personBatch1)
      // @ts-expect-error:TS2345
      .mockResolvedValueOnce(personBatch2);

    const fetcher = new Fetcher();
    const persons = await fetcher.getPersons();

    expect(userListSpy).toHaveBeenCalledTimes(3); // Initial call + two recursive calls
    expect(persons).toHaveLength(200); // 2 batches; 100 persons per batch
    expect(persons[0]).toStrictEqual({
      iri: expect.stringContaining('https://example.org/'),
      id: expect.stringMatching(/.+/),
    });
  });
});

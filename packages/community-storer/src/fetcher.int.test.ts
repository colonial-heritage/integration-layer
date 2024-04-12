import {CommunityFetcher} from './fetcher.js';
import {describe, expect, it} from 'vitest';

describe('getAll', () => {
  it('gets all communities', async () => {
    const fetcher = new CommunityFetcher();
    const communities = await fetcher.getAll();

    // This can change if the source data changes
    expect(communities.length).toBeGreaterThan(0);
  });
});

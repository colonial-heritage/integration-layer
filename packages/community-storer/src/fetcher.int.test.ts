import {Fetcher} from './fetcher.js';
import {describe, expect, it} from 'vitest';

describe('getCommunities', () => {
  it('gets the communities', async () => {
    const fetcher = new Fetcher();
    const communities = await fetcher.getCommunities();

    // This can change if the source data changes
    expect(communities.length).toBeGreaterThan(0);
  });
});

describe('getPersons', () => {
  it('gets the persons', async () => {
    const fetcher = new Fetcher();
    const persons = await fetcher.getPersons();

    // This can change if the source data changes
    expect(persons.length).toBeGreaterThan(0);
  });
});

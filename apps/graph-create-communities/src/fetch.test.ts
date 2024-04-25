import {
  fetchCommunities,
  FetchCommunitiesInput,
  fetchPersons,
  FetchPersonsInput,
} from './fetch.js';
import {Fetcher} from '@colonial-collections/community-storer';
import {pino} from 'pino';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createActor, toPromise} from 'xstate';

const logger = pino();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchCommunities', () => {
  it('fetches communities', async () => {
    vi.spyOn(Fetcher.prototype, 'getCommunities').mockResolvedValue([
      {
        iri: 'https://example.org/1',
        id: '1',
        name: 'Name 1',
      },
    ]);

    const input: FetchCommunitiesInput = {logger};
    const communities = await toPromise(
      createActor(fetchCommunities, {input}).start()
    );

    expect(communities).toStrictEqual([
      {
        iri: 'https://example.org/1',
        id: '1',
        name: 'Name 1',
      },
    ]);
  });
});

describe('fetchPersons', () => {
  it('fetches persons', async () => {
    vi.spyOn(Fetcher.prototype, 'getPersons').mockResolvedValue([
      {
        iri: 'https://example.org/1',
        id: '1',
      },
    ]);

    const input: FetchPersonsInput = {logger};
    const persons = await toPromise(createActor(fetchPersons, {input}).start());

    expect(persons).toStrictEqual([
      {
        iri: 'https://example.org/1',
        id: '1',
      },
    ]);
  });
});

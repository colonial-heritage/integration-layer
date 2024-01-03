import {SparqlChangeChecker} from './checker.js';
import {describe, expect, it} from 'vitest';

const query = `
  PREFIX dbo:	<http://dbpedia.org/ontology/>
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

  SELECT ?identifier ?isChanged
  WHERE {
    {
      SELECT (MAX(?revisionId) AS ?identifier)
      WHERE {
        [] dbo:wikiPageRevisionID ?revisionId
      }
    }
    BIND(xsd:integer("?_currentIdentifier") AS ?currentIdentifier)
    BIND(?identifier > ?currentIdentifier AS ?isChanged)
  }
`;

describe('run', () => {
  it('throws if the endpoint is invalid', async () => {
    expect.assertions(5); // Including retries

    const checker = new SparqlChangeChecker({
      endpointUrl: 'http://localhost',
    });

    checker.on('warning', (err: Error) => {
      expect(err.message).toBe(
        'Failed to fetch results from SPARQL endpoint: fetch failed'
      );
    });

    try {
      await checker.run({
        query,
        currentIdentifier: '1234',
      });
    } catch (err) {
      const error = err as Error;
      expect(error.message).toEqual('fetch failed');
    }
  });

  it('returns false if a resource has not changed since the last check', async () => {
    const checker = new SparqlChangeChecker({
      endpointUrl: 'https://dbpedia.org/sparql',
    });

    const response = await checker.run({
      query,
      currentIdentifier: (1125038679 + 100000).toString(), // Non-existing revision ID. Changes if the source data changes
    });

    expect(response).toStrictEqual({
      identifier: expect.stringMatching(/^\d+$/), // Revision ID
      isChanged: false,
    });
  });

  it('returns true if a resource has changed since the last check', async () => {
    const checker = new SparqlChangeChecker({
      endpointUrl: 'https://dbpedia.org/sparql',
    });

    const response = await checker.run({
      query,
      currentIdentifier: '1124717623', // Old revision ID
    });

    expect(response).toStrictEqual({
      identifier: expect.stringMatching(/^\d+$/), // Revision ID
      isChanged: true,
    });
  });
});

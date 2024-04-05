import {SparqlGenerator} from './generator.js';
import getStream from 'get-stream';
import rdfSerializer from 'rdf-serialize';
import {describe, expect, it} from 'vitest';

// Required to use ESM in both TypeScript and JavaScript
const serializer = rdfSerializer.default ?? rdfSerializer;

const query = `
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  CONSTRUCT {
    ?this a skos:Concept ;
      skos:prefLabel ?prefLabel .
  }
  WHERE {
    VALUES ?this {
      ?_iris
    }
    ?this a skos:Concept ;
      skos:prefLabel ?prefLabel .
    FILTER(LANGMATCHES(LANG(?prefLabel), "en"))
  }
`;

describe('getResources', () => {
  it('errors if the endpoint is invalid', async () => {
    expect.assertions(5); // Including retries

    const generator = new SparqlGenerator({
      endpointUrl: 'http://localhost/sparql',
      query,
    });

    generator.on('warning', (err: Error) => {
      expect(err.message).toBe(
        'Failed to fetch results from SPARQL endpoint for "http://localhost/error.ttl": fetch failed'
      );
    });

    try {
      await generator.getResources(['http://localhost/error.ttl']);
    } catch (err) {
      const error = err as Error;
      expect(error.message).toEqual('fetch failed');
    }
  });

  it('gets resources', async () => {
    const generator = new SparqlGenerator({
      endpointUrl: 'https://vocab.getty.edu/sparql',
      query,
    });

    const quadStream = await generator.getResources([
      'http://vocab.getty.edu/aat/300111999',
      'http://vocab.getty.edu/aat/300026650',
    ]);

    const dataStream = serializer.serialize(quadStream, {
      contentType: 'application/n-triples',
    });
    const result = await getStream(dataStream);

    expect(result).toEqual(
      `<http://vocab.getty.edu/aat/300111999> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2004/02/skos/core#Concept> .
<http://vocab.getty.edu/aat/300111999> <http://www.w3.org/2004/02/skos/core#prefLabel> "publications (documents)"@en .
<http://vocab.getty.edu/aat/300026650> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2004/02/skos/core#Concept> .
<http://vocab.getty.edu/aat/300026650> <http://www.w3.org/2004/02/skos/core#prefLabel> "gazettes"@en .
`
    );
  });
});

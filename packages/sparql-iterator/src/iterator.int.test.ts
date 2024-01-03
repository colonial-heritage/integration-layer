import {SparqlIterator} from './iterator.js';
import fastq from 'fastq';
import {describe, expect, it} from 'vitest';

const query = `
  PREFIX dbo:	<http://dbpedia.org/ontology/>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

  # A random selection of resources
  SELECT ?this
  WHERE {
    {
      SELECT ?this
      WHERE {
        ?this a dbo:Person ;
          foaf:name ?name .
        FILTER(CONTAINS(?name, "John McCallum"))
      }
    }
  }
  LIMIT ?_limit
  OFFSET ?_offset
`;

describe('run', () => {
  it('errors if the endpoint is invalid', async () => {
    expect.assertions(5); // Including retries

    const save = async () => {}; // No-op
    const queue = fastq.promise(save, 1);

    const iterator = new SparqlIterator({
      endpointUrl: 'http://localhost',
      query,
      queue,
    });

    iterator.on('warning', (err: Error) => {
      expect(err.message).toBe(
        'Failed to fetch results from SPARQL endpoint: fetch failed'
      );
    });

    iterator.on('error', (err: Error) => {
      expect(err.message).toBe(
        'Error while collecting 1000 IRIs from offset 0: fetch failed'
      );
    });

    await iterator.run();
  });

  it('iterates', async () => {
    const savedIris: string[] = [];
    const save = async (iri: string) => savedIris.push(iri);
    const queue = fastq.promise(save, 1);

    const iterator = new SparqlIterator({
      endpointUrl: 'https://dbpedia.org/sparql',
      numberOfIrisPerRequest: 1,
      query,
      queue,
    });

    let numberOfEmits = 0;
    iterator.on('collected-iris', () => numberOfEmits++);

    await iterator.run();

    // This can change if the source data changes
    expect(numberOfEmits).toBe(5);
    expect(savedIris).toEqual(
      expect.arrayContaining([
        'http://dbpedia.org/resource/John_McCallum_(sports_writer)',
        'http://dbpedia.org/resource/Jack_Dowding_(footballer)',
        'http://dbpedia.org/resource/John_McCallum',
        'http://dbpedia.org/resource/John_McCallum_(Australian_politician)',
        'http://dbpedia.org/resource/John_McCallum_(actor)',
      ])
    );
  });
});

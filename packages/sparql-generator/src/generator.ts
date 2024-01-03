import {SparqlEndpointFetcher} from 'fetch-sparql-endpoint';
import {EventEmitter} from 'node:events';
import pRetry from 'p-retry';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string().url(),
  endpointMethod: z.enum(['GET', 'POST']).default('POST'),
  timeoutPerRequest: z.number().min(0).default(60000),
  query: z.string(),
});

export type ConstructorOptions = z.input<typeof constructorOptionsSchema>;

export class SparqlGenerator extends EventEmitter {
  private readonly endpointUrl: string;
  private readonly fetcher: SparqlEndpointFetcher;
  private readonly query: string;

  constructor(options: ConstructorOptions) {
    super();

    const opts = constructorOptionsSchema.parse(options);

    this.endpointUrl = opts.endpointUrl;
    this.query = this.validateQuery(opts.query);
    this.fetcher = new SparqlEndpointFetcher({
      method: opts.endpointMethod,
      timeout: opts.timeoutPerRequest,
    });
  }

  private validateQuery(query: string) {
    // Some sanity checks - can be optimized
    // TBD: use sparqljs for validation?
    const bindings = ['?this', '?_iri']; // Basil notation
    const hasBindings = bindings.every(
      binding => query.indexOf(binding) !== -1
    );
    if (!hasBindings) {
      throw new Error(`Bindings are missing in query: ${bindings.join(', ')}`);
    }

    return query;
  }

  async getResource(iri: string) {
    // TBD: instead of doing string replacements, generate a new SPARQL query using sparqljs?
    const query = this.query.replaceAll('?_iri', `<${iri}>`);

    const run = async () => this.fetcher.fetchTriples(this.endpointUrl, query);

    const quadStream = await pRetry(run, {
      retries: 3,
      onFailedAttempt: err => {
        const prettyError = new Error(
          `Failed to fetch results from SPARQL endpoint for "${iri}": ${err.message}`
        );
        prettyError.stack = err.stack;
        this.emit('warning', prettyError);
      },
    });

    return quadStream;
  }
}

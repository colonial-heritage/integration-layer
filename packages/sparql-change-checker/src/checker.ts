import {IBindings, SparqlEndpointFetcher} from 'fetch-sparql-endpoint';
import {EventEmitter} from 'node:events';
import pRetry from 'p-retry';
import {z} from 'zod';

export const constructorOptionsSchema = z.object({
  endpointUrl: z.string().url(),
  endpointMethod: z.enum(['GET', 'POST']).default('POST'),
  timeout: z.number().min(0).default(60000),
});

export type ConstructorOptions = z.input<typeof constructorOptionsSchema>;

export const runOptionsSchema = z.object({
  query: z.string(),
  // E.g. the ID of the last revision or the date of the last modification.
  // Not set if e.g. the check hasn't been done before
  currentIdentifier: z.string().optional(),
});

export type RunOptions = z.input<typeof runOptionsSchema>;

export type RunResponse = {
  identifier: string | undefined;
  isChanged: boolean;
};

export class SparqlChangeChecker extends EventEmitter {
  private readonly endpointUrl: string;
  private readonly fetcher: SparqlEndpointFetcher;

  constructor(options: ConstructorOptions) {
    super();

    const opts = constructorOptionsSchema.parse(options);

    this.endpointUrl = opts.endpointUrl;
    this.fetcher = new SparqlEndpointFetcher({
      method: opts.endpointMethod,
      timeout: opts.timeout,
    });
  }

  private validateQuery(query: string) {
    // TBD: use sparqljs for validation?
    const bindings = ['?identifier', '?isChanged', '?_currentIdentifier']; // Basil notation
    const hasBindings = bindings.every(
      binding => query.indexOf(binding) !== -1
    );
    if (!hasBindings) {
      throw new Error(`Bindings are missing in query: ${bindings.join(', ')}`);
    }

    return query;
  }

  async run(options: RunOptions) {
    const opts = runOptionsSchema.parse(options);

    const unparsedQuery = this.validateQuery(opts.query);

    // TBD: instead of doing string replacements, generate a new SPARQL query using sparqljs?
    const query = unparsedQuery.replaceAll(
      '?_currentIdentifier',
      opts.currentIdentifier !== undefined ? opts.currentIdentifier : ''
    );

    const run = async () => this.fetcher.fetchBindings(this.endpointUrl, query);

    const bindingsStream = await pRetry(run, {
      retries: 3,
      onFailedAttempt: err => {
        const prettyError = new Error(
          `Failed to fetch results from SPARQL endpoint: ${err.message}`
        );
        prettyError.stack = err.stack;
        this.emit('warning', prettyError);
      },
    });

    let identifier;
    let isChanged = false;

    for await (const rawBindings of bindingsStream) {
      const bindings = rawBindings as unknown as IBindings; // TS assumes it's a string or Buffer
      identifier = bindings.identifier.value;
      isChanged = parseInt(bindings.isChanged.value) !== 0;
    }

    const response: RunResponse = {identifier, isChanged};

    return response;
  }
}

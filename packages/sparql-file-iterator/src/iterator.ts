import {QueryEngine} from '@comunica/query-sparql-file';
import {type queueAsPromised} from 'fastq';
import {globStream} from 'glob';
import {EventEmitter} from 'node:events';
import {z} from 'zod';

export const constructorOptionsSchema = z.object({
  dir: z.string(),
  query: z.string(),
  queue: z.any(),
});

export type ConstructorOptions = z.input<typeof constructorOptionsSchema>;

export class SparqlFileIterator extends EventEmitter {
  private readonly dir: string;
  private readonly queryEngine: QueryEngine;
  private readonly query: string;
  private readonly queue: queueAsPromised<string>;

  constructor(options: ConstructorOptions) {
    super();

    const opts = constructorOptionsSchema.parse(options);

    this.dir = opts.dir;
    this.query = this.validateQuery(opts.query);
    this.queryEngine = new QueryEngine();
    this.queue = opts.queue;
  }

  private validateQuery(query: string) {
    // TBD: use sparqljs for validation?
    const bindings = ['?this']; // Basil notation
    const hasBindings = bindings.every(
      binding => query.indexOf(binding) !== -1
    );
    if (!hasBindings) {
      throw new Error(`Bindings are missing in query: ${bindings.join(', ')}`);
    }

    return query;
  }

  private async collectIrisInFile(filename: string) {
    let numberOfIris = 0;

    const bindingsStream = await this.queryEngine.queryBindings(this.query, {
      sources: [filename],
    });
    const bindings = await bindingsStream.toArray();

    for (const binding of bindings) {
      const term = binding.get('this');
      if (term === undefined) {
        continue;
      }

      const iri = term.value;
      numberOfIris++; // For progress monitoring

      // Use a queue to have more control compared to an event emit() - https://www.youtube.com/watch?v=Ra7Ji9LmG9o
      this.queue.push(iri).catch(err => {
        const prettyError = new Error(
          `An error occurred when pushing IRI "${iri}" to queue: ${err.message}`
        );
        prettyError.stack = err.stack;
        this.emit('error', prettyError);
      });
    }

    this.emit('collected-iris', numberOfIris, filename);
  }

  private async collectIris() {
    const filesStream = globStream(`${this.dir}/**/*.{nt,ttl}`, {
      nodir: true,
      absolute: true,
    });

    for await (const filename of filesStream) {
      await this.collectIrisInFile(filename);
    }
  }

  async run() {
    await this.collectIris();
    await this.queue.drained();
  }
}
